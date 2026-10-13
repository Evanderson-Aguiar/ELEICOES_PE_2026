const state={data:null,geo:null,map:null,municipalities:true,sections:true,selected:null,candidateQuery:'',activePopup:null};
const palette=['#087f72','#e76d51','#3977a8','#b07ac3','#d29b21','#476c56','#bd5575','#6174c7','#69757c'];
const fmt=n=>new Intl.NumberFormat('pt-BR').format(n||0);
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const cargoNow=()=>document.querySelector('#cargoSelect').value;
const candidates=()=>state.data.cargos[cargoNow()].candidates;
const selectedCandidates=()=>state.selected===null?candidates():candidates().filter(c=>state.selected.has(c.id));
const cityNow=()=>document.querySelector('#citySelect').value;
const featureName=f=>String(f.properties.NM_MUN||f.properties.NM_MUNICIPIO||f.properties.name||'').toUpperCase();
function init(){
  Promise.all([fetch('data/election-data.json').then(r=>r.json()),fetch('data/municipios.geojson').then(r=>r.json())]).then(([data,geo])=>{
    state.data=data;state.geo=geo;
    const cargo=document.querySelector('#cargoSelect');Object.keys(data.cargos).forEach(x=>cargo.add(new Option(x,x)));
    data.cities.forEach(x=>document.querySelector('#citySelect').add(new Option(x.name,x.id)));
    cargo.addEventListener('change',()=>{state.selected=null;state.candidateQuery='';buildCandidateMenu();refresh()});
    document.querySelector('#candidateButton').addEventListener('click',()=>toggleCandidateMenu());
    document.querySelector('#candidateMenu').addEventListener('change',candidateMenuChange);
    document.addEventListener('pointerdown',e=>{if(!document.querySelector('#candidatePicker').contains(e.target))document.querySelector('#candidateMenu').classList.add('hidden')});
    document.querySelector('#citySelect').addEventListener('change',refresh);
    document.querySelector('#analysisMode').addEventListener('change',renderAnalysis);
    document.querySelector('#resetBtn').addEventListener('click',()=>{document.querySelector('#citySelect').value='__all';state.selected=null;state.candidateQuery='';buildCandidateMenu();refresh()});
    document.querySelector('#municipalityToggle').addEventListener('change',e=>{state.municipalities=e.target.checked;if(state.map){state.map.setLayoutProperty('municipality-fill','visibility',state.municipalities?'visible':'none');state.map.setLayoutProperty('municipality-line','visibility',state.municipalities?'visible':'none')}});
    document.querySelector('#sectionsToggle').addEventListener('change',e=>{state.sections=e.target.checked;if(state.map)state.map.setLayoutProperty('section-points','visibility',state.sections?'visible':'none')});
    document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active-view'));document.querySelector('#'+(b.dataset.view==='mapa'?'mapa':'analises')+'View').classList.add('active-view');if(b.dataset.view==='mapa'&&state.map)setTimeout(()=>state.map.resize(),60)}));
    document.querySelector('#aboutBtn').onclick=()=>document.querySelector('#aboutModal').classList.remove('hidden');document.querySelector('#closeModal').onclick=()=>document.querySelector('#aboutModal').classList.add('hidden');
    document.querySelector('#downloadBtn').onclick=downloadAnalysis;
    buildCandidateMenu();initMap();
  }).catch(err=>{console.error(err);document.body.insertAdjacentHTML('beforeend','<div class="load-error">Não foi possível carregar os dados do painel.</div>')});
}
function buildCandidateMenu(){
  const menu=document.querySelector('#candidateMenu');
  menu.innerHTML=`<div class="candidate-search"><span aria-hidden="true">⌕</span><input id="candidateSearch" type="search" aria-label="Buscar candidato" placeholder="Buscar por nome..." value="${esc(state.candidateQuery)}"><button type="button" id="clearCandidateSearch" aria-label="Limpar busca" title="Limpar busca">×</button></div><label class="candidate-option all-option"><input type="checkbox" value="__all"><span>Todos os candidatos</span></label><div class="candidate-menu-scroll">${candidates().map((c,i)=>`<label class="candidate-option" data-candidate-name="${esc(c.name)}"><input type="checkbox" value="${esc(c.id)}" ${state.selected===null||state.selected.has(c.id)?'checked':''}><i style="--candidate-color:${palette[i%palette.length]}"></i><span>${esc(c.name)}</span><small>${fmt(c.total)}</small></label>`).join('')}</div><div class="candidate-no-results hidden" id="candidateNoResults">Nenhum candidato encontrado.</div>`;
  const search=menu.querySelector('#candidateSearch');search.addEventListener('input',()=>{state.candidateQuery=search.value;filterCandidateOptions()});
  menu.querySelector('#clearCandidateSearch').addEventListener('click',()=>{state.candidateQuery='';search.value='';filterCandidateOptions();search.focus()});
  filterCandidateOptions();
  syncCandidatePicker();
}
function filterCandidateOptions(){
  const query=(state.candidateQuery||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
  let visible=0;document.querySelectorAll('#candidateMenu [data-candidate-name]').forEach(row=>{const name=row.dataset.candidateName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');const match=name.includes(query);row.hidden=!match;if(match)visible++});
  document.querySelector('#candidateNoResults')?.classList.toggle('hidden',visible>0);
}
function toggleCandidateMenu(){const menu=document.querySelector('#candidateMenu');menu.classList.toggle('hidden');document.querySelector('#candidateButton').setAttribute('aria-expanded',String(!menu.classList.contains('hidden')))}
function candidateMenuChange(e){
  if(e.target.type!=='checkbox')return;
  if(e.target.value==='__all')state.selected=e.target.checked?null:new Set();
  else {if(state.selected===null)state.selected=new Set(candidates().map(c=>c.id));if(e.target.checked)state.selected.add(e.target.value);else state.selected.delete(e.target.value)}
  buildCandidateMenu();refresh();
}
function syncCandidatePicker(){
  const all=candidates();const selected=selectedCandidates();const button=document.querySelector('#candidateButton');
  if(selected.length===0)button.innerHTML=`Selecione candidatos <span>⌄</span>`;
  else if(selected.length===all.length)button.innerHTML=`Todos os candidatos <span>⌄</span>`;
  else if(selected.length===1)button.innerHTML=`${esc(selected[0].name)} <span>⌄</span>`;
  else button.innerHTML=`${selected.length} candidatos selecionados <span>⌄</span>`;
  const allBox=document.querySelector('#candidateMenu .all-option input');if(allBox)allBox.checked=state.selected===null||selected.length===all.length;
}
function candidateMunicipalMap(list){const out=new Map();for(const c of list)for(const item of c.municipalities||[]){if(!out.has(item.city))out.set(item.city,{});out.get(item.city)[c.id]=item.votes}return out}
function mapCandidates(active){if(active.length<=8)return active;const leaders=active.slice(0,8);const rest=active.slice(8);const aggregate=new Map();for(const c of rest)for(const item of c.municipalities||[])aggregate.set(item.city,(aggregate.get(item.city)||0)+item.votes);return [...leaders,{id:'__other',name:'Demais candidatos',total:rest.reduce((n,c)=>n+c.total,0),municipalities:[...aggregate].map(([city,votes])=>({city,votes}))}]}
function visibleCities(){const city=cityNow();return city==='__all'?state.data.cities.map(c=>c.id):[city]}
function refresh(){
  if(!state.data)return;
  const list=selectedCandidates();const active=list;const byCity=candidateMunicipalMap(active);const cities=visibleCities();
  const totals=active.map(c=>({candidate:c,votes:cities.reduce((n,city)=>n+(byCity.get(city)?.[c.id]||0),0)}));
  const total=totals.reduce((n,x)=>n+x.votes,0);const secCount=state.data.sections.filter(s=>cityNow()==='__all'||s.city===cityNow()).length;
  document.querySelector('#mapTitle').textContent=active.length===1?`${active[0].name} · votos por município`:`Liderança entre ${active.length} candidatos`;
  document.querySelector('#coverageText').textContent=fmt(secCount);
  const single=active.length===1;const totalForCargo=state.data.cargos[cargoNow()].totalVotes;
  const leading=totals.slice().sort((a,b)=>b.votes-a.votes)[0];
  document.querySelector('#statGrid').innerHTML=[['Votos no recorte',fmt(total),cityNow()==='__all'?'Pernambuco':cityNow()],['Candidatos em comparação',fmt(active.length),single?active[0].name:'cores identificam a liderança'],['Seções mapeadas',fmt(secCount),'com coordenadas'],['Maior votação municipal',leading?fmt(Math.max(...(leading.candidate.municipalities||[]).filter(x=>cityNow()==='__all'||x.city===cityNow()).map(x=>x.votes),0)):'—',leading?.candidate.name||'—']].map(x=>`<div class="stat"><span class="label">${esc(x[0])}</span><div class="value">${x[1]}</div><div class="sub">${esc(x[2])}</div></div>`).join('');
  const mapped=mapCandidates(active);const mappedByCity=candidateMunicipalMap(mapped);
  renderLegend(mapped,single);renderMapData(mapped,mappedByCity);renderMapRanking(mapped,mappedByCity,cities);renderAnalysis();
}
function renderLegend(active,single){const el=document.querySelector('#mapLegend');if(single){el.innerHTML='<span class="gradient-legend"></span><span>menos votos</span><span>mais votos</span>';return}el.innerHTML=active.slice(0,8).map((c,i)=>`<span class="legend-item"><i style="background:${palette[i%palette.length]}"></i>${esc(c.name)}</span>`).join('')+(active.length>8?'<span class="legend-more">+ demais</span>':'')}
function winnerFor(values,active){let winner=null;for(const c of active){const votes=values[c.id]||0;if(!winner||votes>winner.votes)winner={id:c.id,name:c.name,votes,color:palette[active.findIndex(x=>x.id===c.id)%palette.length]}}return winner||{id:'',name:'Sem votos',votes:0,color:'#c9d4d0'}}
function renderMapData(active,byCity){
  if(!state.map||!state.map.isStyleLoaded())return;
  const single=active.length===1;const vals=new Map();for(const [city,values] of byCity){vals.set(city,single?(values[active[0].id]||0):winnerFor(values,active).votes)}
  const max=Math.max(1,...vals.values());state.geo.features.forEach(f=>{const name=featureName(f);const values=byCity.get(name)||{};const winner=winnerFor(values,active);f.properties.city_name=name;f.properties.votes=single?(values[active[0].id]||0):winner.votes;f.properties.intensity=Math.sqrt(f.properties.votes/max);f.properties.winner_id=single?active[0].id:winner.id;f.properties.winner_name=single?active[0].name:winner.name;f.properties.winner_color=single?'#087f72':winner.color;f.properties.detail=JSON.stringify(active.map(c=>({name:c.name,votes:values[c.id]||0,color:palette[active.indexOf(c)%palette.length]})).sort((a,b)=>b.votes-a.votes))});
  state.map.getSource('municipios').setData(state.geo);
  const sectionReady=active.every(c=>state.data.sectionVotes[c.id]);
  const secFeatures=state.data.sections.filter(s=>cityNow()==='__all'||s.city===cityNow()).map(s=>{const values={};for(const c of active)values[c.id]=Number(state.data.sectionVotes[c.id]?.[String(s.id)]||0);const winner=winnerFor(values,active);return{type:'Feature',geometry:{type:'Point',coordinates:[s.lon,s.lat]},properties:{id:s.id,city:s.city,zone:s.zone,section:s.section,local:s.local,votes:single?(values[active[0].id]||0):winner.votes,intensity:0,winner_color:single?'#087f72':winner.color}}});
  const maxSectionVotes=Math.max(1,...secFeatures.map(f=>f.properties.votes));secFeatures.forEach(f=>f.properties.intensity=Math.sqrt(f.properties.votes/maxSectionVotes));
  state.map.getSource('sections').setData({type:'FeatureCollection',features:secFeatures});
  state.map.setPaintProperty('municipality-fill','fill-color',single?['interpolate',['linear'],['get','intensity'],0,'#e7f1ed',.25,'#b8ddd3',.6,'#4faaa0',1,'#087f72']:['get','winner_color']);
  state.map.setPaintProperty('section-points','circle-color',single?['interpolate',['linear'],['get','intensity'],0,'#f6d7ce',.35,'#e76d51',1,'#a94332']:['get','winner_color']);
  const note=document.querySelector('.map-footer .mono');if(note)note.textContent=single&&!sectionReady?'Detalhe por seção indisponível para este candidato; município disponível':'Clique em município ou seção para ver os votos por candidato';
}
function municipalityPopup(name,active,byCity,lngLat){
  const values=byCity.get(name)||{};const rows=active.map((c,i)=>({name:c.name,votes:values[c.id]||0,color:palette[i%palette.length]})).sort((a,b)=>b.votes-a.votes);
  const html=`<div class="vote-popup"><span class="popup-kicker">RESULTADO MUNICIPAL · ${esc(cargoNow())}</span><h3>${esc(name)}</h3>${rows.map(r=>`<div class="popup-candidate"><i style="background:${r.color}"></i><span>${esc(r.name)}</span><b>${fmt(r.votes)}</b></div>`).join('')}<button class="popup-filter" data-city="${esc(name)}">Filtrar este município</button></div>`;
  state.activePopup?.remove();state.activePopup=new maplibregl.Popup({closeButton:true,maxWidth:'360px'}).setLngLat(lngLat).setHTML(html).addTo(state.map);
  const list=state.activePopup.getElement().querySelector('.vote-popup');const scrollToStart=()=>{list.scrollTop=0;list.scrollTo(0,0)};requestAnimationFrame(scrollToStart);setTimeout(scrollToStart,80);
  state.activePopup.getElement().querySelector('.popup-filter').addEventListener('click',()=>{document.querySelector('#citySelect').value=name;state.activePopup.remove();refresh()});
}
function sectionPopup(p,lngLat,active){
  const details=active.map((c,i)=>({name:c.name,votes:Number(state.data.sectionVotes[c.id]?.[String(p.id)]||0),color:palette[i%palette.length]})).sort((a,b)=>b.votes-a.votes);const unavailable=active.filter(c=>!state.data.sectionVotes[c.id]);
  const html=`<div class="vote-popup"><span class="popup-kicker">SEÇÃO ${esc(p.section)} · ZONA ${esc(p.zone)}</span><h3>${esc(p.city)}</h3><p class="popup-local">${esc(p.local)}</p>${details.map(r=>`<div class="popup-candidate"><i style="background:${r.color}"></i><span>${esc(r.name)}</span><b>${fmt(r.votes)}</b></div>`).join('')}${unavailable.length?`<p class="popup-note">Sem detalhamento por seção para: ${unavailable.map(c=>esc(c.name)).join(', ')}.</p>`:''}</div>`;
  state.activePopup?.remove();state.activePopup=new maplibregl.Popup({closeButton:true,maxWidth:'360px'}).setLngLat(lngLat).setHTML(html).addTo(state.map);
}
function initMap(){
  const style={version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'},municipios:{type:'geojson',data:state.geo},sections:{type:'geojson',data:{type:'FeatureCollection',features:[]}}},layers:[{id:'background',type:'raster',source:'osm'},{id:'municipality-fill',type:'fill',source:'municipios',paint:{'fill-color':'#b8ddd3','fill-opacity':.76}},{id:'municipality-line',type:'line',source:'municipios',paint:{'line-color':'#fffefa','line-width':1.1,'line-opacity':.9}},{id:'section-points',type:'circle',source:'sections',paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,2.5,9,5,13,8],'circle-color':'#e76d51','circle-stroke-color':'#fffefa','circle-stroke-width':1,'circle-opacity':.9}}]};
  state.map=new maplibregl.Map({container:'map',style,center:[-36.4,-8.3],zoom:7.1,attributionControl:true});state.map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
  state.map.on('load',()=>{state.map.on('click','municipality-fill',e=>municipalityPopup(featureName(e.features[0]),selectedCandidates(),candidateMunicipalMap(selectedCandidates()),e.lngLat));state.map.on('mouseenter','municipality-fill',()=>state.map.getCanvas().style.cursor='pointer');state.map.on('mouseleave','municipality-fill',()=>state.map.getCanvas().style.cursor='');state.map.on('click','section-points',e=>sectionPopup(e.features[0].properties,e.lngLat,selectedCandidates()));refresh()});
}
function renderMapRanking(active,byCity,cities){
  const rows=[];for(const c of active){const ordered=cities.map(city=>({city,votes:byCity.get(city)?.[c.id]||0})).sort((a,b)=>b.votes-a.votes);if(ordered[0])rows.push({candidate:c,...ordered[0]})}rows.sort((a,b)=>b.votes-a.votes);
  const container=document.querySelector('#rankingList');container.innerHTML=rows.slice(0,6).map((r,i)=>`<div class="candidate-leader"><div class="leader-top"><span class="leader-rank">${String(i+1).padStart(2,'0')}</span><i style="background:${palette[active.findIndex(c=>c.id===r.candidate.id)%palette.length]}"></i><b>${esc(r.candidate.name)}</b></div><div class="leader-city">${esc(r.city)} <strong>${fmt(r.votes)}</strong></div></div>`).join('')||'<p class="empty-state">Selecione candidatos para comparar.</p>';
}
function renderAnalysis(){
  if(!state.data)return;const mode=document.querySelector('#analysisMode').value;const selected=selectedCandidates();const active=selected.length?selected:candidates();const byCity=candidateMunicipalMap(active);const cities=visibleCities();const totals=active.map(c=>({candidate:c,votes:cities.reduce((n,city)=>n+(byCity.get(city)?.[c.id]||0),0)})).sort((a,b)=>b.votes-a.votes);const cityRows=cities.map(city=>({city,values:byCity.get(city)||{},sum:active.reduce((n,c)=>n+(byCity.get(city)?.[c.id]||0),0)}));
  const descriptions={candidate:'Encontre o município de melhor desempenho para cada candidato do filtro.',leaders:'Veja qual candidato selecionado recebeu mais votos em cada município.',ranking:'Compare o total de votos e a participação relativa dos candidatos no recorte.',concentration:'Identifique quanto do voto de cada candidato se concentra no seu principal município.'};
  document.querySelector('#analysisDescription').textContent=descriptions[mode];document.querySelector('#analysisVisual').innerHTML='';
  const summary=document.querySelector('#analysisSummary');
  if(mode==='candidate'){
    const best=active.map(c=>({candidate:c,total:cityRows.reduce((n,r)=>n+(r.values[c.id]||0),0),...cityRows.map(r=>({city:r.city,votes:r.values[c.id]||0})).sort((a,b)=>b.votes-a.votes)[0]})).sort((a,b)=>b.votes-a.votes);
    summary.innerHTML=best.slice(0,4).map((r,i)=>`<article class="analysis-kpi"><span class="section-kicker">${i===0?'MAIOR VOTAÇÃO MUNICIPAL':`CANDIDATO ${String(i+1).padStart(2,'0')}`}</span><strong>${esc(r.city||'—')}</strong><p>${esc(r.candidate.name)} · ${fmt(r.votes)} votos</p></article>`).join('');
    document.querySelector('#analysisKicker').textContent='MELHOR DESEMPENHO POR CANDIDATO';document.querySelector('#analysisTitle').textContent='Onde cada candidato foi mais votado';document.querySelector('#analysisHead').innerHTML='<tr><th>Candidato</th><th>Município de maior votação</th><th>Votos</th><th>% dos votos do candidato</th></tr>';
    document.querySelector('#analysisTable').innerHTML=best.map(r=>`<tr><td><i class="table-color" style="background:${palette[active.indexOf(r.candidate)%palette.length]}"></i><b>${esc(r.candidate.name)}</b></td><td>${esc(r.city||'—')}</td><td>${fmt(r.votes)}</td><td>${r.total?((r.votes/r.total)*100).toFixed(1)+'%':'—'}</td></tr>`).join('');
  }else if(mode==='leaders'){
    const ranked=cityRows.map(r=>{const winner=active.map(c=>({candidate:c,votes:r.values[c.id]||0})).sort((a,b)=>b.votes-a.votes)[0];return{...r,...winner}}).sort((a,b)=>b.votes-a.votes);
    const byLead=new Map();ranked.forEach(r=>{if(!r.candidate)return;byLead.set(r.candidate.id,(byLead.get(r.candidate.id)||0)+1)});
    summary.innerHTML=active.map((c,i)=>`<article class="analysis-kpi"><span class="section-kicker">MUNICÍPIOS LIDERADOS</span><strong>${fmt(byLead.get(c.id)||0)}</strong><p><i class="table-color" style="background:${palette[i%palette.length]}"></i>${esc(c.name)}</p></article>`).join('');
    document.querySelector('#analysisKicker').textContent='CANDIDATO MAIS VOTADO EM CADA MUNICÍPIO';document.querySelector('#analysisTitle').textContent='Liderança municipal';document.querySelector('#analysisHead').innerHTML='<tr><th>Município</th><th>Candidato líder</th><th>Votos</th><th>Diferença para o 2º</th></tr>';
    document.querySelector('#analysisTable').innerHTML=ranked.map(r=>{const votes=active.map(c=>r.values[c.id]||0).sort((a,b)=>b-a);return`<tr><td><b>${esc(r.city)}</b></td><td><i class="table-color" style="background:${palette[active.findIndex(c=>c.id===r.candidate?.id)%palette.length]||'#ccc'}"></i>${esc(r.candidate?.name||'—')}</td><td>${fmt(r.votes)}</td><td>${fmt((votes[0]||0)-(votes[1]||0))}</td></tr>`}).join('');
  }else if(mode==='ranking'){
    const sum=totals.reduce((n,r)=>n+r.votes,0);summary.innerHTML=totals.slice(0,4).map((r,i)=>`<article class="analysis-kpi"><span class="section-kicker">${i===0?'LÍDER NO RECORTE':`POSIÇÃO ${i+1}`}</span><strong>${fmt(r.votes)}</strong><p>${esc(r.candidate.name)} · ${sum?((r.votes/sum)*100).toFixed(1):0}% do total comparado</p></article>`).join('');
    document.querySelector('#analysisKicker').textContent='RESULTADO AGREGADO';document.querySelector('#analysisTitle').textContent=`Ranking estadual · ${cargoNow()}`;document.querySelector('#analysisHead').innerHTML='<tr><th>Posição</th><th>Candidato</th><th>Votos no recorte</th><th>Participação</th></tr>';
    document.querySelector('#analysisTable').innerHTML=totals.map((r,i)=>`<tr><td>#${i+1}</td><td><i class="table-color" style="background:${palette[active.indexOf(r.candidate)%palette.length]}"></i><b>${esc(r.candidate.name)}</b></td><td>${fmt(r.votes)}</td><td>${sum?((r.votes/sum)*100).toFixed(2):'0,00'}%</td></tr>`).join('');
    document.querySelector('#analysisVisual').innerHTML=`<div class="bar-chart">${totals.slice(0,12).map((r,i)=>`<div class="bar-chart-row"><span>${esc(r.candidate.name)}</span><div><i style="width:${totals[0]?.votes?r.votes/totals[0].votes*100:0}%;background:${palette[i%palette.length]}"></i></div><b>${fmt(r.votes)}</b></div>`).join('')}</div>`;
  }else{
    const concentration=active.map(c=>{const ordered=cityRows.map(r=>({city:r.city,votes:r.values[c.id]||0})).sort((a,b)=>b.votes-a.votes);const denominator=cityRows.reduce((n,r)=>n+(r.values[c.id]||0),0);return{candidate:c,...ordered[0],share:denominator?ordered[0]?.votes/denominator:0}}).sort((a,b)=>b.share-a.share);
    summary.innerHTML=concentration.slice(0,4).map((r,i)=>`<article class="analysis-kpi"><span class="section-kicker">VOTO MAIS CONCENTRADO</span><strong>${(r.share*100).toFixed(1)}%</strong><p>${esc(r.candidate.name)} · ${esc(r.city||'—')}</p></article>`).join('');
    document.querySelector('#analysisKicker').textContent='CONCENTRAÇÃO TERRITORIAL';document.querySelector('#analysisTitle').textContent='Dependência do principal município';document.querySelector('#analysisHead').innerHTML='<tr><th>Candidato</th><th>Principal município</th><th>Votos nesse município</th><th>% do total estadual</th></tr>';
    document.querySelector('#analysisTable').innerHTML=concentration.map(r=>`<tr><td><i class="table-color" style="background:${palette[active.indexOf(r.candidate)%palette.length]}"></i><b>${esc(r.candidate.name)}</b></td><td>${esc(r.city||'—')}</td><td>${fmt(r.votes)}</td><td>${(r.share*100).toFixed(2)}%</td></tr>`).join('');
  }
}
function downloadAnalysis(){const table=document.querySelector('#analysisTable');const headers=[...document.querySelectorAll('#analysisHead th')].map(x=>x.textContent.trim());const rows=[headers,...[...table.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim()))];const csv='\ufeff'+rows.map(row=>row.map(x=>'"'+x.replaceAll('"','""')+'"').join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`analise-${cargoNow().toLowerCase().replaceAll(' ','-')}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
init();
