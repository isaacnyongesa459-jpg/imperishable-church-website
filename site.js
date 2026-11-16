(() => {
  const key='imperishable-theme';
  let saved=null; try { saved=localStorage.getItem(key); } catch {}
  const initial=saved==='dark'||saved==='light'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  document.documentElement.dataset.theme=initial;
})();
document.addEventListener('DOMContentLoaded', () => {
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
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
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
