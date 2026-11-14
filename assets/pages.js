// Panda's Knowledge Base · read-only GitHub Pages viewer.
// All document fields are rendered using textContent; uploaded HTML is never executed.
(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls = '', text) => {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined) x.textContent = String(text);
    return x;
  };
  const passwordKey = 'panda_knowledge_unlock';
  const TYPES = {paper: '论文问答 · Q1–Q7', note: '个人文档', review: '领域综述'};
  let publicCards = [], privateCards = [];
  let secret = sessionStorage.getItem(passwordKey) || '';
  let allCards = [];
  let loaded = false;
  const utf8 = new TextDecoder();

  function b64bytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  async function decrypt(envelope, passphrase) {
    if (!window.crypto?.subtle) throw new Error('当前页面不支持安全解密，请使用 HTTPS 的 GitHub Pages 地址。');
    if (envelope.v !== 1 || envelope.alg !== 'AES-256-GCM' ||
        envelope.kdf !== 'PBKDF2-SHA256' || envelope.iterations !== 310000) {
      throw new Error('不支持该加密格式。');
    }
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      {name:'PBKDF2', salt:b64bytes(envelope.salt), iterations:envelope.iterations, hash:'SHA-256'},
      keyMaterial, {name:'AES-GCM', length:256}, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      {name:'AES-GCM', iv:b64bytes(envelope.iv)}, key, b64bytes(envelope.ciphertext));
    return new Uint8Array(plain);
  }
  async function fetchJson(path) {
    const res = await fetch(path, {cache:'no-store'});
    if (!res.ok) throw new Error(`读取文件失败：${res.status}`);
    return res.json();
  }
  function safeGitHub(url) {
    return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(url || '');
  }
  async function unlock(passphrase) {
    const envelope = await fetchJson('./private-catalog.enc');
    const bytes = await decrypt(envelope, passphrase);
    const parsed = JSON.parse(utf8.decode(bytes));
    if (!Array.isArray(parsed)) throw new Error('私密目录内容异常。');
    secret = passphrase;
    sessionStorage.setItem(passwordKey, secret);
    privateCards = parsed;
    allCards = [...publicCards, ...privateCards].sort((a,b)=>(b.updated_at||'').localeCompare(a.updated_at||''));
    return privateCards;
  }
  function lock() {
    secret = '';
    privateCards = [];
    sessionStorage.removeItem(passwordKey);
    allCards = [...publicCards];
  }
  async function initializeCatalog() {
    publicCards = await fetchJson('./public.json');
    if (!Array.isArray(publicCards)) throw new Error('公开目录格式异常。');
    allCards = [...publicCards];
    if (secret) {
      try { await unlock(secret); }
      catch { lock(); }
    }
    loaded = true;
  }
  function link(href, text, cls = '') {
    const a = el('a', cls, text); a.href = href; return a;
  }
  function readUrl(item) {return `./read.html?id=${encodeURIComponent(item.id)}`;}
  function createCard(row) {
    const card = el('article', 'card'), a = link(readUrl(row), '', 'card-link');
    a.append(el('span', 'badge '+row.type, TYPES[row.type] || '内容'));
    a.append(el('h3', '', row.title || '未命名'));
    a.append(el('p', 'excerpt', row.abstract || '点击查看完整内容。'));
    const tags = el('div', 'tags');
    [row.topic, row.research_topic && row.research_topic!==row.topic ? row.research_topic : '',
      row.venue, row.year, row.visibility==='private'?'🔒 密码访问':'']
      .filter(Boolean).forEach(s=>tags.append(el('span','tag',s)));
    a.append(tags, el('div','date',(row.updated_at || '').slice(0,10)));
    card.append(a);
    if (safeGitHub(row.github_url)) {
      const gh = link(row.github_url, 'github', 'github');
      gh.target = '_blank'; gh.rel = 'noopener noreferrer'; card.append(gh);
    }
    return card;
  }
  function optionList(id, values, allLabel) {
    const select = $(id), current = select.value;
    select.replaceChildren(new Option(allLabel, ''));
    [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'zh-CN'))
      .forEach(value=>select.append(new Option(value, value)));
    if ([...select.options].some(o=>o.value===current)) select.value = current;
  }
  function updateFilters() {
    optionList('topic', allCards.map(x=>x.topic), '全部方向');
    optionList('year', allCards.map(x=>x.year), '全部年份');
  }
  function renderHome() {
    const counts = ['all','paper','note','review'].map(t=>({name:
      {all:'全部内容',paper:'论文问答',note:'个人文档',review:'领域综述'}[t],
      count:t==='all'?allCards.length:allCards.filter(c=>c.type===t).length}));
    $('stats').replaceChildren(...counts.map(c=>{
      const div=el('div','stat');div.append(el('b','',String(c.count).padStart(2,'0')), el('span','',c.name));return div;
    }));
    updateFilters();
    const q=$('search').value.trim().toLowerCase(), kind=$('kind').value,
      topic=$('topic').value, year=$('year').value;
    const found=allCards.filter(x=>(!kind||x.type===kind)&&(!topic||x.topic===topic)&&(!year||x.year===year)&&
      (!q||[x.title,x.abstract,x.topic,x.research_topic,x.venue,x.year].join(' ').toLowerCase().includes(q)));
    $('cards').replaceChildren();
    if (!found.length) $('cards').append(el('div','empty','暂无符合条件的内容。'));
    else found.forEach(x=>$('cards').append(createCard(x)));
    $('show-count').textContent=`${found.length} 条内容`;
  }
  function renderRich(node, text) {
    const spans=String(text||'').split(/(\*\*[^*\n]{1,240}\*\*)/g);
    spans.forEach(part=>{
      if (/^\*\*[^*\n]{1,240}\*\*$/.test(part)) node.append(el('strong','',part.slice(2,-2)));
      else if(part)node.append(document.createTextNode(part));
    });
  }
  function paragraphs(parent, text) {
    const chunks=String(text||'').split(/\n\s*\n/).filter(Boolean);
    (chunks.length?chunks:['暂无内容']).forEach(block=>{
      const p=el('p');renderRich(p,block);parent.append(p);
    });
  }
  function section(root, title) {
    const box=el('section','article-section');box.append(el('h2','',title));root.append(box);return box;
  }
  function renderArticle(data, card) {
    const root=$('article');root.replaceChildren();
    document.title=`${data.title} | Panda的知识库`;
    const hero=el('section','article-hero');
    hero.append(el('span','badge '+card.type,TYPES[card.type] || '内容'),el('h1','',data.title||'未命名'));
    const meta=el('div','tags');
    [data.topic,data.venue,data.year,card.visibility==='private'?'🔒 密码访问':''].filter(Boolean)
      .forEach(t=>meta.append(el('span','tag',t)));
    hero.append(meta);
    if (data.abstract) hero.append(el('p','',data.abstract));
    if (safeGitHub(data.github_url)) {
      const a=link(data.github_url,'github','github'); a.target='_blank';a.rel='noopener noreferrer';hero.append(a);
    }
    if(card.pdf_path){
      const pdf=el('button','pdf-button','阅读原文 PDF ↗'); pdf.type='button';
      pdf.addEventListener('click',()=>openPDF(card,pdf));hero.append(pdf);
    }
    root.append(hero);
    if (card.type==='paper') {
      for(const q of (data.qa||[])){
        const box=section(root,`Q${q.id || '?'} · ${q.question || ''}`);
        paragraphs(box,q.answer);
        for(const ev of (q.evidence||[]))box.append(el('p','evidence',`原文依据（p. ${ev.page || '待核对'}）：${ev.excerpt||''}`));
      }
    } else if(card.type==='note') {
      const box=section(root,'文档正文');
      const tags={h1:'h2',h2:'h2',h3:'h3',li:'p',quote:'blockquote',code:'pre','table-row':'p',p:'p'};
      (data.blocks||[]).forEach(block=>{
        const kind=block.type||'p',p=el(tags[kind]||'p');
        if(kind==='code')p.textContent=block.text||'';
        else renderRich(p,block.text||'');
        box.append(p);
      });
    } else {
      const syn=data.synthesis||{};
      paragraphs(section(root,'领域概览'),syn.overview || '暂无');
      for(const [key,title] of [['directions','研究方向与已有工作'],['methods','技术路线对比'],
        ['findings','实验结论'],['gaps','候选研究空白（需核实）'],['next_steps','下一步研究建议']]){
        const box=section(root,title);
        (syn[key]||[]).forEach(claim=>{
          const p=el('p');renderRich(p,claim.text||'');box.append(p);
          if ((claim.source_ids||claim.paper_ids||[]).length)
            box.append(el('p','evidence','来源：'+(claim.source_ids||claim.paper_ids).join('、')));
        });
      }
      const warn=section(root,'不确定性与待核实内容');
      (syn.uncertainties||[]).forEach(item=>paragraphs(warn,item));
      const src=section(root,'资料来源');
      for(const item of data.sources||[]){
        const row=el('div','source');
        if(allCards.some(c=>c.id===item.id))row.append(link(`./read.html?id=${encodeURIComponent(item.id)}`,item.title||item.id));
        else row.textContent=item.title||item.id;
        src.append(row);
      }
    }
    root.append(link('./index.html','← 返回知识库','back'));
  }
  async function loadArticle() {
    const id=new URLSearchParams(location.search).get('id')||'';
    const card=allCards.find(item=>item.id===id);
    if(!card){
      const prompt=el('div','article-section');
      prompt.append(el('h2','','需要解锁或内容不存在'),
        el('p','', '若此内容已加密，请先返回知识库主页输入发布密码。'),
        link('./index.html','返回知识库'));
      $('article').replaceChildren(prompt);return;
    }
    try{
      let data;
      if (card.visibility==='private') {
        if(!secret) throw new Error('需要发布密码');
        const bytes=await decrypt(await fetchJson('./'+card.path),secret);
        data=JSON.parse(utf8.decode(bytes));
      }else data=await fetchJson('./'+card.path);
      renderArticle(data,card);
    }catch(err){$('article').replaceChildren(el('p','empty','内容无法读取：'+err.message));}
  }
  async function openPDF(card,button){
    const tab=window.open('about:blank','_blank');
    button.disabled=true;button.textContent='正在打开 PDF…';
    try {
      let bytes;
      if(card.visibility==='private')bytes=await decrypt(await fetchJson('./'+card.pdf_path),secret);
      else {
        const response=await fetch('./'+card.pdf_path);
        if(!response.ok)throw new Error('原文文件不存在');
        bytes=new Uint8Array(await response.arrayBuffer());
      }
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      if(tab)tab.location.href=url;
      else{const a=link(url,'查看PDF');a.target='_blank';a.rel='noopener';document.body.append(a);a.click();a.remove();}
      setTimeout(()=>URL.revokeObjectURL(url),15*60*1000);
    }catch(e){if(tab)tab.close();alert('无法打开原文：'+e.message);}
    finally{button.disabled=false;button.textContent='阅读原文 PDF ↗';}
  }
  async function home(){
    try {await initializeCatalog();}catch(err){$('cards').replaceChildren(el('p','empty','读取失败：'+err.message));return;}
    const type=new URLSearchParams(location.search).get('type');
    if(['paper','note','review'].includes(type))$('kind').value=type;
    renderHome();
    ['search','kind','topic','year'].forEach(id=>$(id).addEventListener('input',renderHome));
    const feedback=$('unlock-message');
    feedback.textContent=secret?'已解锁：可查看私密卡片。':'公开内容可直接阅读；私密内容需要密码。';
    $('unlock-form').addEventListener('submit',async event=>{
      event.preventDefault(); const input=$('password');
      feedback.textContent='正在解密…';
      try{await unlock(input.value);input.value='';feedback.textContent='解锁成功，私密卡片已显示。';renderHome();}
      catch(error){lock();feedback.textContent='解锁失败：请检查发布密码。';renderHome();}
    });
    $('lock').addEventListener('click',()=>{lock();renderHome();feedback.textContent='已锁定私密内容。';});
  }
  async function read(){
    try{await initializeCatalog();await loadArticle();}
    catch(err){$('article').replaceChildren(el('p','empty','读取失败：'+err.message));}
  }
  if(document.body.dataset.view==='home')home();else if(document.body.dataset.view==='read')read();
})();
