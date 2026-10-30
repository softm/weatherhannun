(function(){
  'use strict';
  var button=document.getElementById('headerMenuButton');
  var drawer=document.getElementById('headerMenuDrawer');
  var backdrop=document.getElementById('headerMenuBackdrop');
  var closeButton=document.getElementById('headerMenuClose');
  if(!button||!drawer||!backdrop||!closeButton)return;
  var lastFocus=null;
  function setOpen(open){
    if(open)lastFocus=document.activeElement;
    drawer.classList.toggle('is-open',open);
    drawer.setAttribute('aria-hidden',String(!open));
    button.setAttribute('aria-expanded',String(open));
    button.setAttribute('aria-label',open?'전체 메뉴 닫기':'전체 메뉴 열기');
    backdrop.hidden=!open;
    document.body.classList.toggle('header-menu-open',open);
    if(open)closeButton.focus();else if(lastFocus&&document.contains(lastFocus))lastFocus.focus();
  }
  button.addEventListener('click',function(){setOpen(button.getAttribute('aria-expanded')!=='true');});
  closeButton.addEventListener('click',function(){setOpen(false);});
  backdrop.addEventListener('click',function(){setOpen(false);});
  drawer.addEventListener('click',function(event){
    if(event.target.closest('[data-view],#locationButton,#refreshButton'))setOpen(false);
  });
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true')setOpen(false);});
})();
