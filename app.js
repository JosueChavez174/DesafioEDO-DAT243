
const $=id=>document.getElementById(id);
const DEF={K:200,r:0.15,y0:10,h:0.96,T:30};
const fmt=(x,d=3)=>Number(x).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const sci=x=>x===0?'0':x.toExponential(2);
const C={orange:'#ff7a00',orange2:'#ffa53d',orangeD:'#d85f00',brown:'#7a3b00',white:'#f4f4f4',black:'#111',yellow:'#ffd166',gray:'#9a9a9a'};
let charts={}, STATE={};

function P(){
  const g=id=>parseFloat($(id).value);
  const p={K:g('K'),r:g('r'),y0:g('y0'),h:g('h'),T:g('T')};
  for(const k in p) if(!isFinite(p[k])||p[k]<=0) p[k]=DEF[k];
  if(p.y0>=p.K) p.y0=p.K/2;
  return p;
}
function resetP(){for(const k in DEF)$(k).value=DEF[k];render();}

/* ================= MODELO Y MÉTODOS ================= */
const f=(y,p)=>p.r*y*(1-y/p.K);
const exact=(t,p)=>p.K/(1+((p.K-p.y0)/p.y0)*Math.exp(-p.r*t));
function step(m,y,h,p){
  if(m==='heun'){const k1=f(y,p),k2=f(y+h*k1,p);return y+h/2*(k1+k2);}
  const k1=f(y,p),k2=f(y+h/2*k1,p),k3=f(y+h/2*k2,p),k4=f(y+h*k3,p);
  return y+h/6*(k1+2*k2+2*k3+k4);
}
function integrate(m,p,h=p.h){
  const t=[0],y=[p.y0];
  const n=Math.floor(p.T/h+1e-9);
  let yy=p.y0,tt=0;
  for(let i=0;i<n;i++){yy=step(m,yy,h,p);tt=(i+1)*h;t.push(tt);y.push(yy);}
  if(p.T-tt>1e-9){const hh=p.T-tt;yy=step(m,yy,hh,p);t.push(p.T);y.push(yy);}
  return {t,y,n:t.length-1};
}
function errStats(num,p){
  const e=num.y.map((v,i)=>v-exact(num.t[i],p));
  const a=e.map(Math.abs);
  let mx=0,im=0;a.forEach((v,i)=>{if(v>mx){mx=v;im=i}});
  const rms=Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
  const mean=a.reduce((s,v)=>s+v,0)/a.length;
  return {e,a,max:mx,tmax:num.t[im],rms,mean,final:a[a.length-1],sfinal:e[e.length-1]};
}
const tFrac=(frac,p)=>{const A=(p.K-p.y0)/p.y0;const v=A*frac/(1-frac);return v>0?Math.log(v)/p.r:null;}; // días para frac*K
function maxErrN(m,p,N){const h=p.T/N;const q={...p,h};const s=integrate(m,q,h);return errStats(s,p).max;}

/* ================= GRÁFICAS ================= */
function theme(t){return t==='dark'?{txt:'#e8e8e8',grid:'rgba(255,255,255,.09)'}:{txt:'#2a2a2a',grid:'rgba(0,0,0,.1)'};}
function opts(th,xt,yt,o={}){
  const c=theme(th);
  return {responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},animation:{duration:500},
    plugins:{legend:{labels:{color:c.txt,usePointStyle:true}},tooltip:{backgroundColor:'#000',borderColor:C.orange,borderWidth:1,titleColor:C.orange2}},
    scales:{x:{type:o.xType||'linear',title:{display:true,text:xt,color:c.txt},ticks:{color:c.txt},grid:{color:c.grid}},
            y:{type:o.yType||'linear',title:{display:true,text:yt,color:c.txt},ticks:{color:c.txt},grid:{color:c.grid}}}};
}
function mk(id,cfg){if(charts[id])charts[id].destroy();charts[id]=new Chart($(id),cfg);}
const xy=(xs,ys)=>xs.map((x,i)=>({x,y:ys[i]}));

/* ================= RENDER PRINCIPAL ================= */
function render(){
  const p=P();
  const H=integrate('heun',p), R=integrate('rk4',p);
  const eH=errStats(H,p), eR=errStats(R,p);
  const ex=H.t.map(t=>exact(t,p));
  const yT=exact(p.T,p);
  STATE={p,H,R,eH,eR,ex};

  // nota malla
  const nFull=Math.floor(p.T/p.h+1e-9), rem=p.T-nFull*p.h;
  $('gridNote').innerHTML = rem>1e-9
    ? `T/h = ${fmt(p.T/p.h,2)} no es entero: se realizan <b>${nFull}</b> pasos de h = ${p.h} (hasta t = ${fmt(nFull*p.h,2)}) y <b>un paso final de ${fmt(rem,2)}</b> para llegar exactamente a t = ${p.T}. Total: ${H.n} pasos, ${H.n+1} nodos.`
    : `T/h = ${nFull}: malla uniforme con ${H.n} pasos y ${H.n+1} nodos.`;

  // KPIs
  $('kpis').innerHTML=`
   <div class="kpi"><small>y(${p.T}) exacta</small><div class="v">${fmt(yT,2)}</div><div class="s">${fmt(100*yT/p.K,1)} % de la capacidad K = ${p.K}</div></div>
   <div class="kpi"><small>Heun (RK2)</small><div class="v">${fmt(H.y[H.n],2)}</div><div class="s">Error final: ${sci(eH.final)} · máx: ${sci(eH.max)}</div></div>
   <div class="kpi"><small>Runge-Kutta 4</small><div class="v">${fmt(R.y[R.n],4)}</div><div class="s">Error final: ${sci(eR.final)} · máx: ${sci(eR.max)}</div></div>
   <div class="kpi"><small>RK4 es más preciso</small><div class="v">×${eR.max>0?fmt(eH.max/eR.max,0):'∞'}</div><div class="s">razón de error máximo Heun / RK4</div></div>`;

  // propiedades analíticas
  const A=(p.K-p.y0)/p.y0, tinf=p.y0<p.K/2?Math.log(A)/p.r:0, rmax=p.r*p.K/4;
  $('props').innerHTML=`
   <div><h3 style="color:#ffa53d">Punto de inflexión</h3><p>y = K/2 = ${p.K/2} mascotas en <b>t* = ln(A)/r = ${fmt(tinf,2)} días</b> (A = ${fmt(A,2)}).</p></div>
   <div><h3 style="color:#ffa53d">Ritmo máximo</h3><p>dy/dt máx = rK/4 = <b>${fmt(rmax,2)} adopciones/día</b>, alcanzado en t*.</p></div>
   <div><h3 style="color:#ffa53d">Equilibrios</h3><p>y = 0 (inestable) y y = K (estable). Cerca de K el sistema relaja con constante de tiempo 1/r = ${fmt(1/p.r,2)} días.</p></div>`;

  /* ---- c1 principal ---- */
  const dt=[];for(let i=0;i<=300;i++)dt.push(p.T*i/300);
  mk('c1',{type:'line',data:{datasets:[
    {label:'Solución exacta',data:xy(dt,dt.map(t=>exact(t,p))),borderColor:C.white,borderWidth:3,pointRadius:0,tension:.2},
    {label:'Heun (RK2)',data:xy(H.t,H.y),borderColor:C.orange,backgroundColor:C.orange,borderWidth:2,pointRadius:4,pointStyle:'rectRot',tension:0},
    {label:'RK4',data:xy(R.t,R.y),borderColor:C.yellow,backgroundColor:C.yellow,borderWidth:0,pointRadius:3,showLine:false},
    {label:'Capacidad K',data:[{x:0,y:p.K},{x:p.T,y:p.K}],borderColor:'#ff3b3b',borderDash:[8,6],borderWidth:1.5,pointRadius:0},
    {label:'Alerta 80 % K',data:[{x:0,y:.8*p.K},{x:p.T,y:.8*p.K}],borderColor:C.orange2,borderDash:[3,5],borderWidth:1.5,pointRadius:0}
  ]},options:opts('dark','Tiempo t (días)','Mascotas acumuladas y(t)')});

  /* ---- c2 error log ---- */
  const idx=H.t.map((t,i)=>i).filter(i=>i>0);
  const pos=(arr)=>idx.map(i=>({x:H.t[i],y:Math.max(arr[i],1e-16)}));
  mk('c2',{type:'line',data:{datasets:[
    {label:'|Error| Heun',data:pos(eH.a),borderColor:C.orange,backgroundColor:C.orange,pointRadius:3,borderWidth:2},
    {label:'|Error| RK4',data:pos(eR.a),borderColor:C.yellow,backgroundColor:C.yellow,pointRadius:3,borderWidth:2}
  ]},options:opts('dark','Tiempo t (días)','|Error| (mascotas)',{yType:'logarithmic'})});

  /* ---- c3 error con signo ---- */
  mk('c3',{type:'bar',data:{labels:H.t.map(t=>fmt(t,2)),datasets:[
    {label:'Heun − exacta',data:eH.e,backgroundColor:eH.e.map(v=>v>=0?C.orange:C.brown)},
  ]},options:(()=>{const o=opts('dark','Tiempo t (días)','Error (mascotas)',{xType:'category'});return o;})()});

  /* ---- c4 ritmo ---- */
  const ratEx=dt.map(t=>f(exact(t,p),p));
  mk('c4',{type:'line',data:{datasets:[
    {label:'dy/dt exacta',data:xy(dt,ratEx),borderColor:C.black,borderWidth:3,pointRadius:0,tension:.2},
    {label:'f(y_RK4) en nodos',data:xy(R.t,R.y.map(y=>f(y,p))),borderColor:C.orangeD,backgroundColor:C.orange,showLine:false,pointRadius:4},
    {label:'Heun: f(y_Heun)',data:xy(H.t,H.y.map(y=>f(y,p))),borderColor:C.orange,backgroundColor:'rgba(255,122,0,.15)',borderDash:[4,4],pointRadius:0,borderWidth:2},
    ...(p.y0<p.K/2&&tinf<=p.T?[{label:`Inflexión t*=${fmt(tinf,1)} d`,data:[{x:tinf,y:rmax}],borderColor:'#c1121f',backgroundColor:'#c1121f',pointRadius:9,pointStyle:'star',showLine:false}]:[])
  ]},options:opts('light','Tiempo t (días)','Adopciones por día')});

  /* ---- c5 fase ---- */
  const yy=[];for(let i=0;i<=200;i++)yy.push(p.K*i/200);
  mk('c5',{type:'line',data:{datasets:[
    {label:'f(y) = r·y(1−y/K)',data:xy(yy,yy.map(y=>f(y,p))),borderColor:C.black,borderWidth:3,pointRadius:0},
    {label:'Trayectoria (RK4)',data:xy(R.y,R.y.map(y=>f(y,p))),borderColor:C.orangeD,backgroundColor:C.orange,showLine:false,pointRadius:4},
    {label:'Equilibrios',data:[{x:0,y:0},{x:p.K,y:0}],borderColor:'#c1121f',backgroundColor:'#c1121f',showLine:false,pointRadius:8}
  ]},options:opts('light','y (mascotas)','dy/dt')});

  /* ---- tabla ---- */
  let rows=`<thead><tr><th>n</th><th>t (días)</th><th>y exacta</th><th>y Heun</th><th>y RK4</th><th>Error Heun</th><th>Error RK4</th><th>Err. rel. Heun %</th></tr></thead><tbody>`;
  H.t.forEach((t,i)=>{rows+=`<tr><td>${i}</td><td>${fmt(t,2)}</td><td>${fmt(ex[i],5)}</td><td>${fmt(H.y[i],5)}</td><td>${fmt(R.y[i],5)}</td><td>${sci(eH.a[i])}</td><td>${sci(eR.a[i])}</td><td>${fmt(100*eH.a[i]/ex[i],4)}</td></tr>`;});
  $('tbl').innerHTML=rows+'</tbody>';

  convergence(p,eH,eR);
  scenarios(p);
  analysis(p,H,R,eH,eR,yT,tinf,rmax);
}

/* ================= CONVERGENCIA ================= */
function convergence(p,eH,eR){
  const Ns=[10,20,40,80,160,320,640];
  const rows=Ns.map(N=>({N,h:p.T/N,eh:maxErrN('heun',p,N),er:maxErrN('rk4',p,N)}));
  rows.forEach((r,i)=>{r.ph=i?Math.log2(rows[i-1].eh/r.eh):null;r.pr=i&&rows[i-1].er>1e-13&&r.er>1e-13?Math.log2(rows[i-1].er/r.er):null;});
  let t=`<thead><tr><th>N</th><th>h</th><th>Err. máx Heun</th><th>p</th><th>Err. máx RK4</th><th>p</th></tr></thead><tbody>`;
  rows.forEach(r=>t+=`<tr><td>${r.N}</td><td>${fmt(r.h,4)}</td><td>${sci(r.eh)}</td><td>${r.ph?fmt(r.ph,2):'—'}</td><td>${sci(r.er)}</td><td>${r.pr?fmt(r.pr,2):'—'}</td></tr>`);
  $('tblConv').innerHTML=t+'</tbody>';
  STATE.conv=rows;
  const r0=rows[0];
  const ref=(k,e0)=>rows.map(r=>({x:r.h,y:e0*Math.pow(r.h/r0.h,k)}));
  mk('c6',{type:'line',data:{datasets:[
    {label:'Heun (RK2)',data:rows.map(r=>({x:r.h,y:r.eh})),borderColor:C.orange,backgroundColor:C.orange,pointRadius:5,borderWidth:2.5},
    {label:'RK4',data:rows.filter(r=>r.er>1e-14).map(r=>({x:r.h,y:r.er})),borderColor:C.yellow,backgroundColor:C.yellow,pointRadius:5,borderWidth:2.5},
    {label:'Pendiente 2 (ref.)',data:ref(2,r0.eh),borderColor:'#888',borderDash:[6,5],pointRadius:0,borderWidth:1.5},
    {label:'Pendiente 4 (ref.)',data:ref(4,r0.er),borderColor:'#bbb',borderDash:[2,4],pointRadius:0,borderWidth:1.5}
  ]},options:opts('dark','Paso h (días)','Error máximo (mascotas)',{xType:'logarithmic',yType:'logarithmic'})});

  // eficiencia: N mínimo para tolerancia
  const tol=0.01;
  const findN=m=>{for(let N=5;N<=3000;N++){if(maxErrN(m,p,N)<tol)return N;}return null;};
  const nh=findN('heun'),nr=findN('rk4');
  const eh=nh?2*nh:null, er=nr?4*nr:null;
  $('eff').innerHTML=`<p>Para garantizar un error máximo menor a <b>${tol} mascotas</b> en todo el intervalo:</p>
   <div class="grid g3" style="margin-top:10px">
    <div><span class="pill warn">Heun</span><p>N ≥ <b>${nh??'>3000'}</b> pasos (h ≈ ${nh?fmt(p.T/nh,3):'—'}) → <b>${eh??'—'}</b> evaluaciones de f.</p></div>
    <div><span class="pill ok">RK4</span><p>N ≥ <b>${nr??'>3000'}</b> pasos (h ≈ ${nr?fmt(p.T/nr,3):'—'}) → <b>${er??'—'}</b> evaluaciones de f.</p></div>
    <div><span class="pill bad">Ahorro</span><p>${eh&&er?`RK4 necesita ${fmt(eh/er,1)}× ${er<eh?'menos':'más'} evaluaciones para la misma exactitud.`:'—'}</p></div>
   </div>`;
  STATE.eff={nh,nr,eh,er,tol};
}

/* ================= ESCENARIOS ================= */
function scenarios(p){
  const rs=[0.05,0.10,0.15,0.20,0.30];
  const cols=['#7a7a7a','#8a3b00',C.orange,'#111','#c1121f'];
  const dt=[];for(let i=0;i<=200;i++)dt.push(p.T*i/200);
  const ds=rs.map((r,i)=>({label:`r = ${r}`,data:xy(dt,dt.map(t=>exact(t,{...p,r}))),borderColor:cols[i],borderWidth:r===0.15?4:2,pointRadius:0,tension:.2}));
  ds.push({label:'Capacidad K',data:[{x:0,y:p.K},{x:p.T,y:p.K}],borderColor:'#c1121f',borderDash:[8,6],borderWidth:1,pointRadius:0});
  mk('c7',{type:'line',data:{datasets:ds},options:opts('light','Tiempo t (días)','Mascotas acumuladas')});
  const d=v=>v==null?'—':fmt(v,1);
  let t=`<thead><tr><th>r</th><th>y(T)</th><th>% K</th><th>dy/dt máx</th><th>t₅₀</th><th>t₈₀</th><th>t₉₀</th></tr></thead><tbody>`;
  rs.concat([p.r]).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b).forEach(r=>{
    const q={...p,r},y=exact(p.T,q);
    t+=`<tr${r===p.r?' style="font-weight:700;background:#ffd9b0"':''}><td>${r}</td><td>${fmt(y,1)}</td><td>${fmt(100*y/p.K,1)}</td><td>${fmt(r*p.K/4,2)}</td><td>${d(tFrac(.5,q))}</td><td>${d(tFrac(.8,q))}</td><td>${d(tFrac(.9,q))}</td></tr>`;});
  $('tblSc').innerHTML=t+'</tbody>';
}

/* ================= ANÁLISIS ================= */
function analysis(p,H,R,eH,eR,yT,tinf,rmax){
  const T=p.T, y1=exact(T/3,p), y2=exact(2*T/3,p);
  const g1=y1-p.y0,g2=y2-y1,g3=yT-y2;
  const rhz=p.r*p.h;
  const stabH=2, stabR=2.785;
  const t50=tFrac(.5,p),t80=tFrac(.8,p),t90=tFrac(.9,p);
  const rReq=(frac)=>{const A=(p.K-p.y0)/p.y0;return Math.log(A*frac/(1-frac))/T;};
  const rneed=rReq(.9);
  const cv=STATE.conv, last=cv.filter(r=>r.ph!==null);
  const phObs=last.slice(0,4).reduce((s,r)=>s+r.ph,0)/Math.min(4,last.length);
  const prRows=cv.filter(r=>r.pr!==null).slice(0,3);
  const prObs=prRows.length?prRows.reduce((s,r)=>s+r.pr,0)/prRows.length:NaN;
  // error local primer paso
  const h=Math.min(p.h,T);
  const l1H=Math.abs(step('heun',p.y0,h,p)-exact(h,p)), l1R=Math.abs(step('rk4',p.y0,h,p)-exact(h,p));
  const biasSign=eH.sfinal<0?'subestima':'sobrestima';

  $('findings').innerHTML=`
  <div class="finding"><div class="n">1</div><div><h3>Evolución en tres fases (curva sigmoidal)</h3>
   <p>En cada tercio del periodo se acumulan <b>${fmt(g1,1)}</b>, <b>${fmt(g2,1)}</b> y <b>${fmt(g3,1)}</b> adopciones netas. La fase intermedia concentra el mayor crecimiento, y en la tercera el ritmo ya decae por la saturación. En t = ${T} días la población exacta es <b>${fmt(yT,2)}</b> (${fmt(100*yT/p.K,1)} % de K); aún quedan ${fmt(p.K-yT,1)} plazas de margen.</p></div></div>

  <div class="finding"><div class="n">2</div><div><h3>Punto de máxima presión: t* = ${fmt(tinf,2)} días</h3>
   <p>${tinf<=T?`Dentro del horizonte, la población cruza K/2 = ${p.K/2} y se alcanza el ritmo pico de <b>${fmt(rmax,2)} adopciones/día</b>. Es el momento de mayor demanda logística (traslados, papeleo, seguimiento) y el de mayor retorno por esfuerzo de difusión.`:`El punto de inflexión queda fuera del horizonte simulado: la campaña sigue en fase de aceleración.`} Antes de t* la población crece de forma casi exponencial (tasa ≈ r); después se desacelera linealmente en y.</p></div></div>

  <div class="finding"><div class="n">3</div><div><h3>Precisión: Heun frente a RK4</h3>
   <p>Con h = ${p.h}: Heun alcanza un error máximo de <b>${sci(eH.max)}</b> mascotas (en t ≈ ${fmt(eH.tmax,2)} d) y un RMS de ${sci(eH.rms)}; RK4 logra <b>${sci(eR.max)}</b> y RMS ${sci(eR.rms)}. RK4 es unas <b>${eR.max>0?fmt(eH.max/eR.max,0):'∞'} veces</b> más preciso. Ambos errores son prácticamente irrelevantes para un conteo de animales: ${eH.max<0.5?'incluso Heun yerra menos de media mascota':'Heun supera media mascota de error'}. Al final del intervalo Heun <b>${biasSign}</b> el valor exacto en ${sci(eH.final)}.</p></div></div>

  <div class="finding"><div class="n">4</div><div><h3>Dónde se concentra el error</h3>
   <p>El error se acumula donde la curvatura de y(t) es mayor (la zona de transición entre crecimiento exponencial y saturación, máximo en t ≈ ${fmt(eH.tmax,1)} d) y luego se amortigua cuando la solución se acerca al equilibrio estable y = K, porque el sistema "olvida" el error previo (la derivada de f en K es −r &lt; 0). Es una propiedad disipativa favorable de la logística.</p></div></div>

  <div class="finding"><div class="n">5</div><div><h3>Orden de convergencia verificado</h3>
   <p>Al refinar la malla, la razón de error da un orden observado ≈ <b>${fmt(phObs,2)}</b> para Heun (teórico 2) y ≈ <b>${isNaN(prObs)?'—':fmt(prObs,2)}</b> para RK4 (teórico 4). Error local del primer paso: Heun ${sci(l1H)} y RK4 ${sci(l1R)}, coherentes con O(h³) y O(h⁵). Esto valida la implementación y confirma que al reducir h a la mitad Heun gana ≈ 4× de precisión y RK4 ≈ 16×.</p></div></div>

  <div class="finding"><div class="n">6</div><div><h3>Estabilidad numérica</h3>
   <p>Linealizando en y = K, el parámetro relevante es r·h = <b>${fmt(rhz,3)}</b>. Heun es estable si r·h &lt; ${stabH} y RK4 si r·h &lt; ≈${stabR}. ${rhz<stabH?'<span class="pill ok">Estable</span> Estás muy lejos del límite, así que no hay oscilaciones espurias ni divergencia.':'<span class="pill bad">Inestable</span> El paso es demasiado grande: reduce h.'}</p></div></div>

  <div class="finding"><div class="n">7</div><div><h3>Costo–beneficio computacional</h3>
   <p>RK4 cuesta el doble por paso (4 vs. 2 evaluaciones de f), pero ${STATE.eff.eh&&STATE.eff.er?`para un error &lt; ${STATE.eff.tol} mascotas necesita sólo ${STATE.eff.er} evaluaciones frente a ${STATE.eff.eh} de Heun`:'su mayor orden lo compensa con creces'}. Para esta EDO, que tiene solución cerrada, el ahorro es didáctico; en modelos ampliados (ingresos, estacionalidad, varias especies), sin solución analítica, RK4 será el método de referencia.</p></div></div>

  <div class="finding"><div class="n">8</div><div><h3>Efectividad de la campaña: ¿alcanza r = ${p.r}?</h3>
   <p>${t90&&t90<=T?`Se llega al 90 % de K en ${fmt(t90,1)} días.`:`Con r = ${p.r} no se llega al 90 % de K en ${T} días (se necesitarían ${t90?fmt(t90,1):'—'} días).`} Para alcanzar el 90 % de K en exactamente ${T} días haría falta <b>r ≈ ${fmt(rneed,3)}</b> (${fmt(100*(rneed/p.r-1),1)} % ${rneed>p.r?'más':'menos'} efectividad). La tabla de escenarios muestra que duplicar r no duplica el beneficio: reduce los tiempos de forma inversamente proporcional (t ∝ 1/r), pero el techo siempre es K.</p></div></div>`;

  // semáforo
  const row=(lab,frac,cls)=>{const t=tFrac(frac,p);const inside=t!=null&&t<=T;return `<p style="margin-bottom:10px"><span class="pill ${cls}">${lab}</span> ${fmt(frac*p.K,0)} mascotas (${frac*100} % K) → ${t==null?'—':'día '+fmt(t,1)} ${inside?'(<b>dentro</b> del horizonte)':'(fuera del horizonte)'}</p>`;};
  $('semaforo').innerHTML=row('Verde',0.5,'ok')+row('Ámbar',0.8,'warn')+row('Rojo',0.9,'bad')+
   `<p class="note">Interpretación: el semáforo marca cuándo la ocupación acumulada cruza cada umbral. Úsalo para disparar acciones preventivas con ~1–2 semanas de antelación.</p>`;

  // recomendaciones
  $('reco').innerHTML=`<ul>
   <li>Concentrar los esfuerzos <b>antes</b> de t* ≈ ${fmt(tinf,0)} días: es cuando la difusión se amplifica por contagio social.</li>
   <li>Preparar logística (veterinaria, transporte, contratos de adopción) para el pico de ${fmt(rmax,1)} adopciones/día.</li>
   <li>Activar <b>hogares temporales</b> al cruzar el umbral del 80 % (día ${t80?fmt(t80,1):'—'}) para evitar saturación.</li>
   <li>Si el objetivo es llegar al 90 %, subir la efectividad hasta r ≈ ${fmt(rneed,2)} (más alianzas, eventos de adopción, redes).</li>
   <li>Calibrar r y K con datos reales semanales y repetir la simulación.</li></ul>`;

  // conclusión
  $('concl').innerHTML=`<h3>✅ Conclusión: respuesta a la pregunta</h3>
   <p style="margin-top:10px">Bajo un programa continuo de difusión con r = ${p.r} días⁻¹, la población acumulada pasa de <b>${p.y0}</b> a <b>${fmt(yT,1)} mascotas</b> en ${T} días siguiendo una curva sigmoidal, con ritmo máximo de ${fmt(rmax,1)}/día hacia el día ${fmt(tinf,1)}, sin llegar a saturar el refugio (${fmt(100*yT/p.K,1)} % de K).</p>
   <p style="margin-top:10px">Ambos métodos reproducen la solución exacta con gran fidelidad: <b>Heun</b> con error máximo ${sci(eH.max)} y <b>RK4</b> con ${sci(eR.max)} mascotas. RK4 es ≈ ${eR.max>0?fmt(eH.max/eR.max,0):'∞'} veces más preciso con sólo el doble de costo por paso, y los órdenes observados (${fmt(phObs,1)} y ${isNaN(prObs)?'—':fmt(prObs,1)}) confirman la teoría. Para planeación operativa del refugio, cualquiera de los dos es suficiente; RK4 es la opción robusta cuando el modelo se haga más complejo.</p>`;
}

/* ================= CSV ================= */
function downloadCSV(){
  const {H,R,eH,eR,ex}=STATE;
  let s='n,t,y_exacta,y_heun,y_rk4,err_heun,err_rk4\n';
  H.t.forEach((t,i)=>s+=[i,t,ex[i],H.y[i],R.y[i],eH.a[i],eR.a[i]].join(',')+'\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'text/csv'}));a.download='simulacion_refugio.csv';a.click();
}

['K','r','y0','h','T'].forEach(id=>$(id).addEventListener('change',render));
render();