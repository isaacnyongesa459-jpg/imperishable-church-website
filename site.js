document.addEventListener('DOMContentLoaded', () => {
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
  if(form) form.addEventListener('submit',e=>{
    e.preventDefault();
    if(!form.reportValidity()) return;
    const name=form.querySelector('#name').value.trim();
    const email=form.querySelector('#email').value.trim();
    const subject=form.querySelector('#subject').value.trim()||'Website enquiry';
    const message=form.querySelector('#message').value.trim();
    const body=`Name: ${name}\nReply email: ${email}\n\n${message}`;
    window.location.href=`mailto:imperishablec@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(error => {
        console.error('Church website offline support could not start:', error);
      });
    });
  }
});
