window.CHURCH_CONFIG = Object.freeze({
  name: 'Imperishable Crown Bible Baptist Church',
  country: 'Kenya',
  currency: 'KES',
  timezone: 'Africa/Nairobi',
  coordinates: Object.freeze({ latitude: '1.233251', longitude: '34.936605' }),
  weatherUrl: 'https://api.open-meteo.com/v1/forecast?latitude=1.233251&longitude=34.936605&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Africa%2FNairobi'
});

(() => {
  const key='imperishable-theme';
  let saved=null; try { saved=localStorage.getItem(key); } catch {}
  const initial=saved==='dark'||saved==='light'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  document.documentElement.dataset.theme=initial;
})();
document.addEventListener('DOMContentLoaded', () => {
  const church=window.CHURCH_CONFIG;
  const themeButton=document.createElement('button');
  themeButton.type='button'; themeButton.className='theme-toggle'; themeButton.setAttribute('aria-label','Switch to dark mode');
  const paintTheme=()=>{const dark=document.documentElement.dataset.theme==='dark';themeButton.textContent=dark?'☀ Light':'◐ Theme';themeButton.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');};
  themeButton.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('imperishable-theme',next);}catch{}paintTheme();});
  const header=document.querySelector('.header-inner'); if(header){header.append(themeButton);paintTheme();}
  document.querySelectorAll('.main-nav a[href^="https://imperishable-church-mpesa-backend-fa2a.onrender.com/admin/login"]').forEach(a=>{const u=new URL(a.href);u.searchParams.set('theme',document.documentElement.dataset.theme);a.href=u.toString();});

  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#mainNav');
  const closeMenu = () => { if (!toggle || !nav) return; nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label','Open navigation menu'); toggle.textContent='☰'; };
  if (toggle && nav) {
    toggle.addEventListener('click', () => { const open=nav.classList.toggle('is-open'); toggle.setAttribute('aria-expanded',String(open)); toggle.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu'); toggle.textContent=open?'×':'☰'; });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();toggle.focus();}});
    window.addEventListener('resize',()=>{if(window.innerWidth>760)closeMenu();});
  }
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Intl.DateTimeFormat('en-KE',{timeZone:church.timezone,year:'numeric'}).format(new Date()));

  const churchClock=document.querySelector('[data-church-clock]');
  const churchDate=document.querySelector('[data-church-date]');
  const updateChurchClock=()=>{
    const now=new Date();
    if(churchClock){churchClock.textContent=new Intl.DateTimeFormat('en-KE',{timeZone:church.timezone,hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}).format(now);churchClock.dateTime=now.toISOString();}
    if(churchDate)churchDate.textContent=new Intl.DateTimeFormat('en-KE',{timeZone:church.timezone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);
  };
  if(churchClock||churchDate){updateChurchClock();window.setInterval(updateChurchClock,1000);}

  const weather=document.querySelector('[data-church-weather]');
  if(weather){
    const summary=weather.querySelector('[data-weather-summary]');
    const details=weather.querySelector('[data-weather-details]');
    const labels={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Heavy freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'};
    const loadWeather=async()=>{
      const controller=new AbortController();
      const timeout=window.setTimeout(()=>controller.abort(),8000);
      try{
        const response=await fetch(church.weatherUrl,{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('Weather request failed');
        const data=await response.json();
        const current=data.current;
        if(!current)throw new Error('Weather data unavailable');
        const label=labels[current.weather_code]||'Current conditions';
        if(summary)summary.textContent=`${label} · ${Math.round(current.temperature_2m)}°C`;
        if(details)details.textContent=`Feels like ${Math.round(current.apparent_temperature)}°C · ${Math.round(current.relative_humidity_2m)}% humidity · Wind ${Math.round(current.wind_speed_10m)} km/h`;
      }catch(error){
        console.warn('Church weather unavailable:',error);
        if(summary)summary.textContent='Weather temporarily unavailable';
        if(details)details.textContent=`Church location · ${church.timezone}`;
      }finally{window.clearTimeout(timeout);}
    };
    loadWeather();
    window.setInterval(loadWeather,10*60*1000);
  }
  const form=document.querySelector('#contactForm');
  if(form) form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!form.reportValidity()) return;
    const name=form.querySelector('#name').value.trim();
    const email=form.querySelector('#email').value.trim();
    const subject=form.querySelector('#subject').value.trim()||'Website enquiry';
    const message=form.querySelector('#message').value.trim();
    const submit=form.querySelector('[type="submit"]'); if(submit) submit.disabled=true;
    try {
      const response=await fetch('https://imperishable-church-mpesa-backend-fa2a.onrender.com/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,subject,message})});
      const result=await response.json(); if(!response.ok) throw new Error(result.error||'Could not send your message.');
      form.reset(); const toast=document.querySelector('#siteToast'); if(toast){toast.textContent=result.message||'Your message was sent.';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),4500);}
    } catch(error) { const toast=document.querySelector('#siteToast'); if(toast){toast.textContent=error.message||'Could not send your message.';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),5000);} }
    finally { if(submit) submit.disabled=false; }
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(error => {
        console.error('Church website offline support could not start:', error);
      });
    });
  }
});
