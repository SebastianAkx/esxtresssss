/* ===== AnonU - Demo frontend (fase 1) =====
   Funciona totalmente en el navegador usando localStorage.
   NO es seguro para producción: contraseñas se hashean con una función simple
   únicamente para evitar almacenar texto plano en este demo.
   Para producción: backend, bcrypt, HTTPS, validación de dominio y control de sesiones.
*/

/* ---------- Config y claves en localStorage ---------- */
const USERS_KEY = 'anonu_users_v1';
const POSTS_KEY = 'anonu_posts_v1';
const CHATS_KEY = 'anonu_chats_v1';

/* ---------- Cargar/Guardar localStorage ---------- */
function loadUsers(){ return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
function saveUsers(u){ localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

function loadPosts(){ return JSON.parse(localStorage.getItem(POSTS_KEY) || '[]'); }
function savePosts(p){ localStorage.setItem(POSTS_KEY, JSON.stringify(p)); }

function loadChats(){ return JSON.parse(localStorage.getItem(CHATS_KEY) || '[]'); }
function saveChats(c){ localStorage.setItem(CHATS_KEY, JSON.stringify(c)); }

/* ---------- Estado runtime ---------- */
let currentUser = null; // objeto usuario logueado {id,email,role,aliasSeed}
let users = loadUsers();
let posts = loadPosts();
let chats = loadChats();

/* ---------- Helpers ---------- */
function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }
function nowIso(){ return new Date().toISOString(); }

function simpleHash(s){
  // Función de hash simple (no criptográfica). DEMO only.
  let h=0;
  for(let i=0;i<s.length;i++){ h = ((h<<5)-h) + s.charCodeAt(i); h |= 0; }
  return (h>>>0).toString(16);
}

function makeAlias(seed){
  // Alias público y anónimo generado a partir de semilla del usuario/post
  const num = Math.abs(hashCode(seed)) % 900 + 100;
  return `Anónimo #${num}`;
}
function hashCode(str){
  let h=0; for(let i=0;i<str.length;i++){ h = ((h<<5)-h) + str.charCodeAt(i); h|=0; } return h;
}

/* ---------- DOM elements ---------- */
const authSection = document.getElementById('auth');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');
const roleEl = document.getElementById('role');
const btnRegister = document.getElementById('btnRegister');
const btnLogin = document.getElementById('btnLogin');

const createPostSection = document.getElementById('createPostSection');
const postText = document.getElementById('postText');
const btnPost = document.getElementById('btnPost');
const currentAliasEl = document.getElementById('currentAlias');

const userBox = document.getElementById('userBox');
const feed = document.getElementById('feed');
const modalContainer = document.getElementById('modalContainer');

/* ---------- Auth: Register & Login ---------- */

btnRegister.addEventListener('click', () => {
  const email = emailEl.value.trim().toLowerCase();
  const password = passEl.value;
  const role = roleEl.value;
  if(!email || !password) return alert('Email y contraseña son requeridos para registrar.');
  // simple email check
  if(!email.includes('@')) return alert('Ingresa un correo válido.');
  // check duplicates
  if(Object.values(users).some(u => u.email === email)){
    return alert('Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.');
  }
  const id = uid('user');
  const seed = id + '|' + email;
  const user = {
    id, email, role, aliasSeed: seed, passwordHash: simpleHash(password),
    pendingDm: [] // {postId,fromPsych,reqId}
  };
  users[id] = user;
  saveUsers(users);
  alert('Registro exitoso. Ahora puedes iniciar sesión.');
  // optionally auto-login:
  loginUser(email, password);
});

btnLogin.addEventListener('click', () => {
  const email = emailEl.value.trim().toLowerCase();
  const password = passEl.value;
  if(!email || !password) return alert('Introduce email y contraseña.');
  loginUser(email, password);
});

function loginUser(email, password){
  const found = Object.values(users).find(u => u.email === email);
  if(!found) return alert('Usuario no encontrado. Regístrate primero.');
  if(found.passwordHash !== simpleHash(password)) return alert('Contraseña incorrecta.');
  currentUser = found;
  renderAfterLogin();
}

/* ---------- Logout ---------- */
function logout(){
  currentUser = null;
  location.reload(); // simple reset
}

/* ---------- UI after login ---------- */
function renderAfterLogin(){
  authSection.classList.add('hidden');
  createPostSection.classList.remove('hidden');
  currentAliasEl.textContent = makeAlias(currentUser.aliasSeed);
  userBox.innerHTML = `
    <div class="text-sm">
      <div>${makeAlias(currentUser.aliasSeed)}</div>
      <div class="text-xs text-gray-500">${currentUser.role}</div>
      <div class="mt-2"><button id="btnLogout" class="text-xs text-red-600">Cerrar sesión</button></div>
    </div>`;
  document.getElementById('btnLogout').addEventListener('click', logout);
  renderFeed();
}

/* ---------- Posts: crear y render ---------- */

btnPost.addEventListener('click', () => {
  if(!currentUser) return alert('Debes iniciar sesión para publicar.');
  const text = postText.value.trim();
  if(!text) return alert('Escribe algo antes de publicar.');
  const post = {
    id: uid('post'),
    authorId: currentUser.id,
    aliasSeed: currentUser.aliasSeed + '|' + Math.random().toString(36).slice(2,6),
    text,
    likes: 0,
    reports: 0,
    createdAt: nowIso(),
    comments: [],   // {id,authorId,aliasSeed,text,createdAt}
    dmRequests: []  // {id,psychId,createdAt,status}
  };
  posts.unshift(post);
  savePosts(posts);
  postText.value = '';
  renderFeed();
});

/* ---------- Render feed (siempre visible aunque no logueado) ---------- */

function renderFeed(){
  // reload from storage to keep sincronizado
  users = loadUsers();
  posts = loadPosts();
  chats = loadChats();

  feed.innerHTML = '';
  if(posts.length === 0){
    feed.innerHTML = `<div class="bg-white p-4 rounded shadow text-gray-500">No hay publicaciones todavía. Sé el primero en compartir.</div>`;
    return;
  }
  posts.forEach(post => {
    feed.appendChild(renderPostCard(post));
  });
}

/* ---------- Render card de post ---------- */
function renderPostCard(post){
  const card = document.createElement('article');
  card.className = 'bg-white p-4 rounded shadow';

  const alias = makeAlias(post.aliasSeed);
  const isAuthor = currentUser && currentUser.id === post.authorId;
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-2';
  header.innerHTML = `
    <div>
      <div class="font-medium">${alias}</div>
      <div class="text-xs text-gray-400">${new Date(post.createdAt).toLocaleString()}</div>
    </div>
    <div class="text-sm text-gray-500">${isAuthor ? '(Tu publicación)' : ''}</div>
  `;

  const ptext = document.createElement('p');
  ptext.className = 'my-2';
  ptext.textContent = post.text;

  const actions = document.createElement('div');
  actions.className = 'flex items-center gap-3 text-sm text-gray-600';

  const likeBtn = document.createElement('button');
  likeBtn.className = 'flex items-center gap-1';
  likeBtn.innerHTML = `❤️ <span>${post.likes}</span>`;
  likeBtn.addEventListener('click', () => {
    // anyone can like even sin login; but could require login - keep open
    post.likes++;
    savePosts(posts);
    renderFeed();
  });

  const commentBtn = document.createElement('button');
  commentBtn.className = 'flex items-center gap-1';
  commentBtn.innerHTML = `💬 <span>${post.comments.length}</span>`;
  commentBtn.addEventListener('click', () => toggleComments(post.id));

  const reportBtn = document.createElement('button');
  reportBtn.className = 'text-red-600';
  reportBtn.textContent = 'Reportar';
  reportBtn.addEventListener('click', () => {
    if(confirm('¿Deseas reportar esta publicación?')) {
      post.reports++;
      savePosts(posts);
      alert('Publicado reportado. Un administrador revisará (demo).');
      renderFeed();
    }
  });

  actions.appendChild(likeBtn);
  actions.appendChild(commentBtn);
  actions.appendChild(reportBtn);

  // DM: solo visible para psicólogos que no son autores
  let dmBtn = null;
  if(currentUser && currentUser.role === 'psychologist' && currentUser.id !== post.authorId){
    dmBtn = document.createElement('button');
    dmBtn.className = 'ml-auto bg-indigo-600 text-white px-3 py-1 rounded text-sm';
    const existing = post.dmRequests.find(r => r.psychId === currentUser.id);
    if(existing){
      dmBtn.textContent = existing.status === 'pending' ? 'Solicitud enviada' : (existing.status === 'accepted' ? 'Conexión aceptada' : 'Solicitud rechazada');
      dmBtn.disabled = true;
      dmBtn.classList.add('opacity-60', 'cursor-not-allowed');
    } else {
      dmBtn.textContent = 'Ofrecer ayuda (DM)';
      dmBtn.addEventListener('click', () => {
        const req = { id: uid('dmreq'), psychId: currentUser.id, createdAt: nowIso(), status: 'pending' };
        post.dmRequests.push(req);
        savePosts(posts);
        // notify the author by storing pending on author
        if(users[post.authorId]){
          users[post.authorId].pendingDm = users[post.authorId].pendingDm || [];
          users[post.authorId].pendingDm.push({ postId: post.id, fromPsych: currentUser.id, reqId: req.id });
          saveUsers(users);
        }
        alert('Solicitud enviada. El estudiante verá una notificación y podrá aceptar/rechazar.');
        renderFeed();
      });
    }
  }

  // Comments container
  const commentsWrap = document.createElement('div');
  commentsWrap.id = 'comments_' + post.id;
  commentsWrap.className = 'mt-4 border-t pt-3 hidden';

  // Comment input (solo si logueado)
  if(currentUser){
    const commentForm = document.createElement('div');
    commentForm.className = 'flex gap-2';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = 'Comenta anónimamente...';
    inp.className = 'flex-1 p-2 border rounded';
    const send = document.createElement('button');
    send.className = 'bg-blue-600 text-white px-3 py-1 rounded';
    send.textContent = 'Comentar';
    send.addEventListener('click', () => {
      const txt = inp.value.trim();
      if(!txt) return;
      const comment = {
        id: uid('c'),
        authorId: currentUser.id,
        aliasSeed: currentUser.aliasSeed + '|' + Math.random().toString(36).slice(2,5),
        text: txt,
        createdAt: nowIso()
      };
      post.comments.push(comment);
      savePosts(posts);
      inp.value = '';
      renderFeed();
      // open comments
      setTimeout(()=> toggleComments(post.id), 50);
    });
    commentForm.appendChild(inp);
    commentForm.appendChild(send);
    commentsWrap.appendChild(commentForm);
  } else {
    const p = document.createElement('p');
    p.className = 'text-xs text-gray-500';
    p.textContent = 'Inicia sesión para comentar o publicar.';
    commentsWrap.appendChild(p);
  }

  // list existing comments
  const list = document.createElement('div');
  list.className = 'mt-3 space-y-2 text-sm';
  post.comments.forEach(c => {
    const ci = document.createElement('div');
    ci.className = 'p-2 bg-gray-50 rounded';
    const roleTag = users[c.authorId] ? users[c.authorId].role : 'estudiante';
    ci.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="font-medium">${makeAlias(c.aliasSeed)} <span class="text-xs text-gray-400">(${roleTag})</span></div>
        <div class="text-xs text-gray-400">${new Date(c.createdAt).toLocaleString()}</div>
      </div>
      <div class="mt-1">${escapeHtml(c.text)}</div>
    `;
    list.appendChild(ci);
  });
  commentsWrap.appendChild(list);

  // Append sections
  card.appendChild(header);
  card.appendChild(ptext);
  card.appendChild(actions);
  if(dmBtn) card.appendChild(dmBtn);
  card.appendChild(commentsWrap);

  // If the current logged user is the author and has pending dm requests, show them
  if(currentUser && currentUser.id === post.authorId && users[currentUser.id] && users[currentUser.id].pendingDm){
    const pend = users[currentUser.id].pendingDm;
    if(pend.length){
      const notif = document.createElement('div');
      notif.className = 'mt-3 p-3 bg-yellow-50 border rounded';
      notif.innerHTML = `<div class="font-medium">Solicitudes de conversación privada</div>`;
      pend.forEach(n => {
        if(n.postId !== post.id) return;
        const row = document.createElement('div');
        row.className = 'mt-2 flex items-center gap-2';
        row.innerHTML = `<div class="flex-1 text-sm">Un/a psicólogo/a ofrece conversar en privado.</div>`;
        const accept = document.createElement('button');
        accept.className = 'bg-green-600 text-white px-3 py-1 rounded text-sm';
        accept.textContent = 'Aceptar';
        accept.addEventListener('click', () => {
          const req = post.dmRequests.find(r => r.id === n.reqId);
          if(req) req.status = 'accepted';
          // create chat
          const chat = { id: uid('chat'), studentId: currentUser.id, psychId: n.fromPsych, accepted: true, messages: [] };
          chats.push(chat);
          saveChats(chats);
          // remove pending
          users[currentUser.id].pendingDm = users[currentUser.id].pendingDm.filter(x => x.reqId !== n.reqId);
          saveUsers(users);
          savePosts(posts);
          alert('Conversación creada. Se abrirá un chat (demo).');
          openChat(chat.id);
          renderFeed();
        });
        const reject = document.createElement('button');
        reject.className = 'bg-gray-300 text-sm px-3 py-1 rounded';
        reject.textContent = 'Rechazar';
        reject.addEventListener('click', () => {
          const req = post.dmRequests.find(r => r.id === n.reqId);
          if(req) req.status = 'rejected';
          users[currentUser.id].pendingDm = users[currentUser.id].pendingDm.filter(x => x.reqId !== n.reqId);
          saveUsers(users);
          savePosts(posts);
          renderFeed();
        });
        row.appendChild(accept);
        row.appendChild(reject);
        notif.appendChild(row);
      });
      card.appendChild(notif);
    }
  }

  return card;
}

/* ---------- Toggle comments ---------- */
function toggleComments(postId){
  const el = document.getElementById('comments_' + postId);
  if(!el) return;
  el.classList.toggle('hidden');
}

/* ---------- Chat modal (demo) ---------- */
function openChat(chatId){
  const chat = chats.find(c => c.id === chatId);
  if(!chat) return alert('Chat no encontrado');
  const psych = users[chat.psychId];
  modalContainer.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50';
  const box = document.createElement('div');
  box.className = 'w-full max-w-lg bg-white rounded shadow-lg p-4';
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-3';
  header.innerHTML = `<div><strong>Chat privado</strong><div class="text-xs text-gray-500">Con ${psych ? 'Psicólogo (anónimo)' : 'Psicólogo'}</div></div>`;
  const close = document.createElement('button');
  close.className = 'text-sm text-red-600';
  close.textContent = 'Cerrar';
  close.addEventListener('click', () => { modalContainer.innerHTML = ''; });
  header.appendChild(close);

  const messagesWrap = document.createElement('div');
  messagesWrap.className = 'h-64 overflow-auto border p-2 rounded bg-gray-50';
  chat.messages.forEach(m => {
    const mdiv = document.createElement('div');
    mdiv.className = 'mb-2';
    const who = m.from === 'psych' ? 'Psicólogo' : 'Tú';
    mdiv.innerHTML = `<div class="text-xs text-gray-500">${who} · ${new Date(m.at).toLocaleString()}</div><div>${escapeHtml(m.text)}</div>`;
    messagesWrap.appendChild(mdiv);
  });

  const form = document.createElement('div');
  form.className = 'mt-3 flex gap-2';
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'Escribe un mensaje...';
  inp.className = 'flex-1 p-2 border rounded';
  const send = document.createElement('button');
  send.className = 'bg-blue-600 text-white px-3 py-1 rounded';
  send.textContent = 'Enviar';
  send.addEventListener('click', () => {
    const t = inp.value.trim();
    if(!t) return;
    const from = (currentUser && currentUser.id === chat.psychId) ? 'psych' : 'student';
    chat.messages.push({ id: uid('m'), from, text: t, at: nowIso() });
    saveChats(chats);
    openChat(chatId); // reabrir para actualizar
  });

  form.appendChild(inp);
  form.appendChild(send);

  box.appendChild(header);
  box.appendChild(messagesWrap);
  box.appendChild(form);
  overlay.appendChild(box);
  modalContainer.appendChild(overlay);
}

/* ---------- Utilities ---------- */
function escapeHtml(s){
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

/* ---------- Inicialización ---------- */
function init(){
  // cargar users/posts/chats
  users = loadUsers();
  posts = loadPosts();
  chats = loadChats();

  // render feed visible siempre
  renderFeed();

  // si había una "última sesión" guardada, no la auto-restauramos por simplicidad. 
  // El usuario debe iniciar sesión manualmente (más seguro en demo).
}
init();

/* ---------- Exponer helpers (opcional) ---------- */
window.__anonu = { loadUsers, saveUsers, loadPosts, savePosts, uid, makeAlias };
