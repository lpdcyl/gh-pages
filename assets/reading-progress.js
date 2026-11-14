/* Panda V16 · per-browser reading progress, shared by local and GitHub Pages readers.
 * Data contains only kind/id/percent/completed; never stores document contents.
 */
(() => {
  'use strict';
  if (window.PandaReadingProgress) return;
  const prefix = 'panda_read_progress_v1:';
  const kinds = new Set(['paper', 'note', 'review']);
  const clean = (kind, id) => kinds.has(kind) && typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
  const key = (kind, id) => prefix + kind + ':' + id;
  const empty = () => ({percent:0, completed:false});
  const node = (tag, cls, value) => { const el = document.createElement(tag); if(cls) el.className=cls; if(value!==undefined) el.textContent=value; return el; };
  function get(kind,id){
    if(!clean(kind,id)) return empty();
    try {
      const raw=JSON.parse(localStorage.getItem(key(kind,id)) || 'null');
      if(!raw || typeof raw !== 'object') return empty();
      const completed=raw.completed === true;
      const percent=completed ? 100 : Math.min(99,Math.max(0,Math.round(Number(raw.percent)||0)));
      return {percent,completed};
    }catch{return empty();}
  }
  function save(kind,id,change){
    if(!clean(kind,id)) return get(kind,id);
    const previous=get(kind,id);
    const completed=change.completed===true ? true : change.completed===false ? false : previous.completed;
    const next={percent:completed ? 100 : Math.max(0,Math.min(99,Math.round(Number(change.percent ?? previous.percent)||0))),completed,updated_at:new Date().toISOString()};
    try{localStorage.setItem(key(kind,id),JSON.stringify(next));}catch{} // Storage can be disabled by browser settings.
    window.dispatchEvent(new CustomEvent('panda:reading-progress-change',{detail:{kind,id,state:next}}));
    return next;
  }
  function progressState(kind,id){return get(kind,id).completed ? 'done' : get(kind,id).percent>0 ? 'reading':'unread';}
  function label(state){return state.completed ? '已读 · 100%' : state.percent ? `阅读中 · ${state.percent}%` : '未读 · 0%';}
  function card(kind,id){
    const panel=node('div','panda-card-progress');
    panel.dataset.readKind=kind;panel.dataset.readId=id;
    const line=node('div','panda-card-progress-line');
    const caption=node('span','panda-card-progress-label');
    const action=node('button','panda-card-progress-action');action.type='button';
    action.setAttribute('aria-label','切换阅读状态');
    line.append(caption,action);
    const track=node('div','panda-progress-track');track.setAttribute('role','progressbar');
    track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
    const fill=node('div','panda-progress-fill');track.append(fill);
    function update(){
      const state=get(kind,id);
      caption.textContent=label(state);fill.style.width=state.percent+'%';
      track.setAttribute('aria-valuenow',String(state.percent));track.setAttribute('aria-label',`${label(state)}，阅读进度`);
      panel.dataset.readStatus=state.completed?'done':state.percent?'reading':'unread';
      action.textContent=state.completed?'重新阅读':'标记已读';
      action.title=state.completed?'重置为未读':'标记为已读（100%）';
    }
    action.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const state=get(kind,id);
      save(kind,id,{percent:state.completed?0:100,completed:!state.completed});
      update();
    });
    window.addEventListener('panda:reading-progress-change',ev=>{
      if(ev.detail?.kind===kind&&ev.detail?.id===id)update();
    });
    window.addEventListener('pageshow',update);
    panel.append(line,track);update();return panel;
  }
  function mount({kind,id,root,after}){
    if(!root||!clean(kind,id)||root.querySelector('.panda-reading-toolbar')) return;
    const toolbar=node('section','panda-reading-toolbar');
    toolbar.setAttribute('aria-label','阅读进度');
    const title=node('div','panda-reading-toolbar-info');
    title.append(node('strong','','阅读进度'),node('span','panda-reading-toolbar-status'));
    const buttons=node('div','panda-reading-toolbar-actions');
    const done=node('button','panda-reading-done','标记已读');done.type='button';
    const reset=node('button','panda-reading-reset','重置进度');reset.type='button';
    buttons.append(done,reset);toolbar.append(title,buttons);
    const reference=after && root.contains(after) ? after : root.firstElementChild;
    if(reference?.nextSibling)root.insertBefore(toolbar,reference.nextSibling);
    else root.append(toolbar);
    const status=title.querySelector('.panda-reading-toolbar-status');
    const update=()=>{
      const data=get(kind,id);
      status.textContent=label(data);
      done.textContent=data.completed?'已标记完成 ✓':'标记已读';done.disabled=data.completed;
      toolbar.dataset.readStatus=progressState(kind,id);
    };
    done.addEventListener('click',()=>{save(kind,id,{percent:100,completed:true});update();});
    reset.addEventListener('click',()=>{save(kind,id,{percent:0,completed:false});update();});
    window.addEventListener('panda:reading-progress-change',ev=>{
      if(ev.detail?.kind===kind&&ev.detail?.id===id)update();
    });
    window.addEventListener('pageshow',update);
    let pending=false;
    const onScroll=()=>{
      if(pending || document.hidden) return;
      pending=true;
      requestAnimationFrame(()=>{
        pending=false;
        const old=get(kind,id);
        if(old.completed) return;
        const offset=root.getBoundingClientRect().top+window.scrollY;
        const distance=Math.max(root.scrollHeight-window.innerHeight*.6,200);
        const seen=window.scrollY+window.innerHeight*.60-offset;
        const percent=Math.min(99,Math.max(0,Math.round(seen/distance*100)));
        if(percent>old.percent)save(kind,id,{percent,completed:false});
      });
    };
    window.addEventListener('scroll',onScroll,{passive:true});
    update();
  }
  window.PandaReadingProgress={get,save,progressState,card,mount};
})();
