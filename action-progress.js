"use strict";
(function () {
  var active=new Map(),sequence=0,hideTimer=null;
  var root,bar,label;
  function ensure(){
    if(root)return root;
    root=document.createElement("div");
    root.className="action-progress";
    root.hidden=true;
    root.setAttribute("role","status");
    root.setAttribute("aria-live","polite");
    root.setAttribute("aria-atomic","true");
    root.innerHTML='<span class="action-progress-track" aria-hidden="true"><i></i></span><span class="action-progress-label"><span class="action-progress-spinner" aria-hidden="true"></span><b>처리 중…</b></span>';
    document.body.appendChild(root);
    bar=root.querySelector(".action-progress-track i");
    label=root.querySelector(".action-progress-label b");
    return root;
  }
  function render(){
    ensure();
    clearTimeout(hideTimer);
    var current=Array.from(active.values()).at(-1);
    if(current){
      label.textContent=current;
      root.hidden=false;
      root.classList.remove("finishing");
      requestAnimationFrame(function(){root.classList.add("running");});
      return;
    }
    root.classList.remove("running");
    root.classList.add("finishing");
    hideTimer=setTimeout(function(){root.hidden=true;root.classList.remove("finishing");bar.style.transform="";},220);
  }
  function begin(message){
    var id=++sequence;
    active.set(id,message||"처리 중…");
    render();
    return id;
  }
  function end(id){
    if(id===undefined||id===null)return;
    active.delete(id);
    render();
  }
  function pulse(message,duration){
    var id=begin(message);
    setTimeout(function(){end(id);},Math.max(320,duration||520));
    return id;
  }
  function track(promise,message){
    var id=begin(message);
    return Promise.resolve(promise).finally(function(){end(id);});
  }
  function actionLabel(target){
    if(target.matches("[data-view]"))return "화면을 이동하는 중…";
    var text=(target.getAttribute("aria-label")||target.title||target.textContent||"").trim().replace(/\s+/g," ");
    return text?text.slice(0,30)+" 처리 중…":"요청을 처리하는 중…";
  }
  function bind(){
    ensure();
    document.addEventListener("click",function(event){
      if(event.defaultPrevented||event.button!==0)return;
      var target=event.target.closest&&event.target.closest("a[href],button,[role=button]");
      if(!target||target.matches(":disabled,[aria-disabled=true],[data-progress=off]"))return;
      if(target.matches("a[href]")){
        if(target.target==="_blank"||target.hasAttribute("download"))return;
        var href=target.getAttribute("href");
        if(!href||href.charAt(0)==="#")return pulse("페이지 안에서 이동하는 중…",420);
        begin("페이지를 이동하는 중…");
        return;
      }
      pulse(actionLabel(target),target.matches("[data-view]")?420:520);
    },true);
    window.addEventListener("pageshow",function(){active.clear();render();});
  }
  window.WeatherActionProgress={begin:begin,end:end,pulse:pulse,track:track};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
