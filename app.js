"use strict";

const $ = selector => document.querySelector(selector);
const state = { games: [], category: "All", query: "", user: null, progress: {}, activeGame: null, clickerTimer: null };
const categoryIcons = { Clicker:"🍪", Arcade:"⚡", Puzzle:"🧩", Quiz:"🧠", Adventure:"🗺️", Card:"🃏", Chance:"🎲", Board:"♟️", Learning:"📚" };
const iconMap = { cookie:"🍪",space:"🚀",gold:"🪙",candy:"🍬",dragon:"🐉",pixel:"⛏️",gem:"💎",potion:"🧪",burger:"🍔",banana:"🍌",neon:"🎯",lightning:"⚡",color:"🎨",number:"🔢",memory:"🧠",sequence:"🔁",math:"➗",word:"🔤",keyboard:"⌨️",target:"🎯",bubble:"🫧",star:"⭐",quiz:"❔",science:"🔬",history:"🏛️",globe:"🌍",animal:"🦊",tech:"💻",football:"⚽",planet:"🪐",maze:"🌀",treasure:"🧭",dungeon:"🏰",forest:"🌲",ocean:"🌊",rocket:"🚀",piano:"🎹",pattern:"🔷",odd:"👀",cards:"🃏",coin:"🪙",dice:"🎲",rps:"✊",tic:"❎",connect:"🔴",sudoku:"🔢",shape:"🔶",beat:"🎵",brain:"🧠",island:"🏝️",comet:"☄️" };

async function api(url, options = {}) {
  const response = await fetch(url, { credentials:"same-origin", headers:{ "Content-Type":"application/json", ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}
function esc(value) { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function renderCategories() {
  const cats = ["All", ...new Set(state.games.map(g => g.category))];
  $("#categories").innerHTML = cats.map(c => `<button class="category-btn ${state.category===c?"active":""}" data-category="${esc(c)}">${esc(c)}</button>`).join("");
  $("#categories").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => { state.category = btn.dataset.category; renderCategories(); renderGames(); }));
}
function renderGames() {
  const filtered = state.games.filter(g => (state.category==="All" || g.category===state.category) && (g.title+" "+g.description+" "+g.category).toLowerCase().includes(state.query.toLowerCase()));
  $("#gameCount").textContent = `${filtered.length} GAME${filtered.length===1?"":"S"}`;
  $("#gameGrid").innerHTML = filtered.map(g => `
    <button class="game-card" data-game="${g.id}" style="--glow:${g.type==="clicker"?"#267dd4":"#235da4"}">
      <div class="game-top"><span class="game-icon">${iconMap[g.icon] || "🎮"}</span><span class="game-tag">${esc(g.category.toUpperCase())}</span></div>
      <div class="game-info"><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><div class="play-line"><span>PLAY NOW</span><span>↗</span></div></div>
    </button>`).join("");
  $("#emptyState").classList.toggle("hidden", filtered.length !== 0);
  $("#gameGrid").querySelectorAll("[data-game]").forEach(btn => btn.addEventListener("click", () => openGame(Number(btn.dataset.game))));
}
function openModal(html) { $("#modalContent").innerHTML = html; $("#modalBackdrop").classList.remove("hidden"); }
function closeModal() { $("#modalBackdrop").classList.add("hidden"); clearInterval(state.clickerTimer); state.clickerTimer = null; state.activeGame = null; }
function accountModal(mode="login") {
  const isLogin = mode === "login";
  openModal(`<h2 id="modalTitle">${isLogin?"Welcome back.":"Create your player account."}</h2><p>${isLogin?"Sign in to sync your game progress.":"Choose a username and a strong password. Keep your login details private."}</p>
    <form class="form-stack" id="authForm"><label>Username<input name="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" autocomplete="username" placeholder="YourPlayerName"></label>
    <label>Password<input name="password" type="password" required minlength="10" maxlength="72" autocomplete="${isLogin?"current-password":"new-password"}" placeholder="At least 10 characters"></label>
    <button class="primary-btn" type="submit">${isLogin?"Sign in":"Create account"}</button></form>
    <div class="form-switch">${isLogin?"New here?":"Already registered?"} <button class="text-button" id="switchAuth">${isLogin?"Create an account":"Sign in"}</button></div>`);
  $("#authForm").addEventListener("submit", async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    try {
      const result = await api(`/api/auth/${isLogin?"login":"register"}`, { method:"POST", body:JSON.stringify({ username:form.get("username"), password:form.get("password") }) });
      state.user = result.user; await loadProgress(); closeModal(); updateAccountButton(); toast(`Welcome, ${state.user.username}!`);
    } catch (err) { toast(err.message); }
  });
  $("#switchAuth").addEventListener("click", () => accountModal(isLogin?"register":"login"));
}
function updateAccountButton() {
  $("#accountBtn").textContent = state.user ? state.user.username : "Sign in";
}
async function loadProgress() {
  if (!state.user) return;
  try { const rows = await api("/api/progress"); state.progress = Object.fromEntries(rows.map(r => [r.gameId,r])); } catch {}
}
async function saveProgress(game, score, data) {
  if (!state.user) return;
  try { await api(`/api/progress/${game.id}`, { method:"PUT", body:JSON.stringify({ score:Math.max(0,Math.floor(score)), state:data }) }); }
  catch (e) { toast(e.message); }
}
function gameHeader(game, score=0) {
  return `<div class="eyebrow">${esc(game.category.toUpperCase())} · GAME ${game.id}</div><h2 id="modalTitle">${esc(game.title)}</h2><p>${esc(game.description)}</p><div class="game-play-area"><div class="big-emoji">${iconMap[game.icon]||"🎮"}</div><div class="game-score" id="gameScore">${score}</div><div class="game-message" id="gameMessage">Ready? Let's play.</div><div id="gameControls"></div></div>`;
}
function setScore(n) { const el=$("#gameScore"); if(el) el.textContent = String(n); }
function setMessage(s) { const el=$("#gameMessage"); if(el) el.textContent = s; }
function controls(html) { $("#gameControls").innerHTML = html; }
function openGame(id) {
  const game = state.games.find(g => g.id===id); if(!game) return;
  state.activeGame = game; clearInterval(state.clickerTimer);
  const saved = state.progress[id]?.state || {};
  openModal(gameHeader(game, saved.coins || 0));
  switch(game.type) {
    case "clicker": runClicker(game, saved); break;
    case "reaction": runReaction(game); break;
    case "number": runNumber(game); break;
    case "memory": runMemory(game); break;
    case "typing": runTyping(game); break;
    case "target": runTarget(game); break;
    case "quiz": runQuiz(game); break;
    case "maze": runMaze(game); break;
    case "rps": runRps(game); break;
    case "tic": runTic(game); break;
    default: runQuiz(game);
  }
}
function runClicker(game, saved={}) {
  let coins = Math.max(0,Number(saved.coins)||0), power = Math.max(1,Number(saved.power)||1), cost = Math.max(10,Number(saved.cost)||25), perSecond = Math.max(0,Number(saved.perSecond)||0);
  const update = () => { setScore(`${Math.floor(coins).toLocaleString()} coins`); $("#gameMessage").textContent = `+${power} per tap · +${perSecond}/sec · Upgrade costs ${cost}`; };
  controls(`<div class="game-actions"><button id="tapBtn">${iconMap[game.icon]||"🍪"} TAP!</button><button id="upgradeBtn">Upgrade ×2 (${cost})</button><button id="autoBtn">Auto +1/sec (100)</button></div>`);
  $("#tapBtn").addEventListener("click", () => { coins+=power; update(); });
  $("#upgradeBtn").addEventListener("click", () => { if(coins<cost) return setMessage("Not enough coins yet — keep tapping!"); coins-=cost; power*=2; cost=Math.ceil(cost*1.8); update(); });
  $("#autoBtn").addEventListener("click", () => { if(coins<100) return setMessage("You need 100 coins for an auto producer."); coins-=100; perSecond+=1; update(); });
  state.clickerTimer = setInterval(() => { coins+=perSecond; update(); },1000);
  update();
  const save = () => saveProgress(game,coins,{coins,power,cost,perSecond});
  $("#modalContent").querySelector(".modal-close").addEventListener("click",save);
  document.addEventListener("visibilitychange", function saveOnHide(){ if(document.hidden && state.activeGame?.id===game.id) save(); }, {once:true});
}
function runReaction(game) {
  let score=0, rounds=0, started=0, waiting=false, timer=null;
  controls(`<div class="game-actions"><button id="startRound">Start round</button><button id="hitBtn" disabled>CLICK WHEN READY</button></div>`);
  $("#startRound").onclick=()=>{ clearTimeout(timer); waiting=true; $("#hitBtn").disabled=true; setMessage("Wait for the signal..."); timer=setTimeout(()=>{started=performance.now();$("#hitBtn").disabled=false;setMessage("NOW! CLICK!");},900+Math.random()*2300); };
  $("#hitBtn").onclick=()=>{if(!waiting)return;waiting=false;const ms=Math.round(performance.now()-started);score+=Math.max(1,Math.round(1000/ms));rounds++;setScore(`${ms} ms`);setMessage(`Round ${rounds}/5 · points ${score}`);$("#hitBtn").disabled=true;if(rounds>=5){setMessage(`Finished! Total points: ${score}`);saveProgress(game,score,{best:score});}};
}
function runNumber(game) {
  let score=0, count=0, answer=0;
  const next=()=>{const a=2+Math.floor(Math.random()*20),b=2+Math.floor(Math.random()*20);answer=a+b;setMessage(`Question ${count+1}: ${a} + ${b} = ?`);controls(`<form class="form-stack" id="numberForm"><label>Your answer<input id="numberAnswer" type="number" required></label><button class="primary-btn">Submit answer</button></form>`);$("#numberForm").onsubmit=e=>{e.preventDefault();count++;if(Number($("#numberAnswer").value)===answer){score+=10;setMessage("Correct! +10 points.");}else setMessage(`Not quite — the answer was ${answer}.`);setScore(score);if(count<10)setTimeout(next,650);else saveProgress(game,score,{score});};}; next();
}
function runMemory(game) {
  let seq=[],input=[],level=0,locked=true;
  const show=()=>{seq.push(Math.floor(Math.random()*4));input=[];locked=true;setScore(`Level ${level+1}`);setMessage("Watch the sequence, then repeat it.");controls(`<div class="game-actions">${[0,1,2,3].map((n)=>`<button data-tile="${n}" style="min-width:62px;font-size:20px">${["🔵","🟣","🟢","🟡"][n]}</button>`).join("")}</div>`);let i=0;const flash=()=>{if(i>=seq.length){locked=false;setMessage("Your turn!");return;}const btn=$(`[data-tile="${seq[i]}"]`);btn.style.filter="brightness(2)";setTimeout(()=>{btn.style.filter="";i++;setTimeout(flash,220);},420);};setTimeout(flash,450);$("#gameControls").querySelectorAll("[data-tile]").forEach(btn=>btn.onclick=()=>{if(locked)return;const n=Number(btn.dataset.tile);input.push(n);if(input[input.length-1]!==seq[input.length-1]){setMessage(`Game over — you reached level ${level}.`);saveProgress(game,level,{best:level});controls(`<div class="game-actions"><button id="again">Try again</button></div>`);$("#again").onclick=()=>{seq=[];level=0;show();};return;}if(input.length===seq.length){level++;setTimeout(show,500);}});};show();
}
function runTyping(game) {
  const words=["intergalactic","blue lightning","cookie factory","pixel adventure","game champion","rocket engine"];
  let score=0,word=words[Math.floor(Math.random()*words.length)];
  setMessage("Type the phrase exactly, then press Enter.");
  controls(`<form class="form-stack" id="typeForm"><label>Phrase: <b>${esc(word)}</b><input id="typeInput" autocomplete="off" required></label><button class="primary-btn">Check</button></form>`);
  $("#typeForm").onsubmit=e=>{e.preventDefault();if($("#typeInput").value.trim().toLowerCase()===word){score+=10;setScore(score);setMessage("Correct! +10 points.");word=words[Math.floor(Math.random()*words.length)];$("#typeForm").querySelector("b").textContent=word;$("#typeInput").value="";}else setMessage("Not quite — try again.");};
}
function runTarget(game) {
  let score=0,remaining=20,active=false,timer;
  controls(`<div class="game-actions"><button id="targetStart">Start 20-second round</button><button id="targetHit" disabled>🎯 HIT TARGET</button></div>`);
  $("#targetStart").onclick=()=>{score=0;remaining=20;active=true;$("#targetHit").disabled=false;setMessage("Go!");setScore(score);timer=setInterval(()=>{remaining--;setMessage(`${remaining} seconds left`);if(remaining<=0){clearInterval(timer);active=false;$("#targetHit").disabled=true;setMessage(`Time! Final score: ${score}`);saveProgress(game,score,{best:score});}},1000);};
  $("#targetHit").onclick=()=>{if(active){score++;setScore(score);}};
}
function runQuiz(game) {
  const questions=[["Which planet is known as the Red Planet?",["Mars","Venus","Jupiter"],0],["How many sides does a hexagon have?",["Five","Six","Eight"],1],["Which is the largest ocean?",["Atlantic","Indian","Pacific"],2],["What gas do plants absorb?",["Oxygen","Carbon dioxide","Helium"],1],["How many minutes are in an hour?",["50","60","100"],1],["Which animal is a mammal?",["Shark","Dolphin","Trout"],1]];
  let index=0,score=0;
  const show=()=>{if(index>=questions.length){setScore(`${score}/${questions.length}`);setMessage("Quiz complete!");controls(`<div class="game-actions"><button id="quizAgain">Play again</button></div>`);$("#quizAgain").onclick=()=>{index=0;score=0;show();};saveProgress(game,score,{best:score});return;}const q=questions[index];setMessage(`Question ${index+1} of ${questions.length}: ${q[0]}`);controls(`<div class="quiz-options">${q[1].map((v,i)=>`<button data-answer="${i}">${esc(v)}</button>`).join("")}</div>`);$("#gameControls").querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>{if(Number(b.dataset.answer)===q[2])score++;index++;setScore(score);show();});};show();
}
function runMaze(game) {
  let pos=0,steps=0;
  const draw=()=>{setScore(`${steps} steps`);setMessage(pos>=8?"You escaped the maze!":"Move along the path to reach the exit.");controls(`<div class="game-actions">${["⬅️","➡️","⬆️","⬇️"].map(x=>`<button data-move>${x}</button>`).join("")}</div><div class="game-message">START ${"▫️".repeat(Math.max(0,8-pos))} 🏁</div>`);$("#gameControls").querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{if(pos<8){pos++;steps++;draw();}if(pos>=8){setMessage("You found the exit!");saveProgress(game,Math.max(1,100-steps),{steps});}});};draw();
}
function runRps(game) {
  let wins=0,rounds=0;const opts=["Rock","Paper","Scissors"];
  controls(`<div class="game-actions">${opts.map(x=>`<button data-rps="${x}">${x}</button>`).join("")}</div>`);
  $("#gameControls").querySelectorAll("[data-rps]").forEach(b=>b.onclick=()=>{const you=b.dataset.rps,bot=opts[Math.floor(Math.random()*3)];rounds++;if(you===bot)setMessage(`Draw! Computer chose ${bot}.`);else if((you==="Rock"&&bot==="Scissors")||(you==="Paper"&&bot==="Rock")||(you==="Scissors"&&bot==="Paper")){wins++;setMessage(`You win! Computer chose ${bot}.`);}else setMessage(`Computer wins with ${bot}.`);setScore(`${wins} wins`);if(rounds>=5){saveProgress(game,wins,{wins});setMessage(`Match complete: ${wins} wins in 5 rounds.`);}});
}
function runTic(game) {
  let board=Array(9).fill(""),done=false;
  const draw=()=>{controls(`<div class="game-actions" style="display:grid;grid-template-columns:repeat(3,60px);gap:6px">${board.map((v,i)=>`<button data-cell="${i}" style="height:55px;font-size:20px">${v||"·"}</button>`).join("")}</div><div class="game-actions"><button id="ticReset">Reset</button></div>`);$("#gameControls").querySelectorAll("[data-cell]").forEach(b=>b.onclick=()=>move(Number(b.dataset.cell)));$("#ticReset").onclick=()=>{board=Array(9).fill("");done=false;draw();setMessage("Your turn — you are X.");};};
  const winner=()=>{const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const [a,b,c] of lines)if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];return board.every(Boolean)?"draw":null;};
  const move=i=>{if(done||board[i])return;board[i]="X";let w=winner();if(!w){const free=board.map((v,j)=>v?null:j).filter(v=>v!==null);if(free.length)board[free[Math.floor(Math.random()*free.length)]]="O";w=winner();}if(w){done=true;setMessage(w==="X"?"You win!":w==="O"?"Computer wins.":"It's a draw.");if(w==="X")saveProgress(game,1,{wins:1});}else setMessage("Your turn — you are X.");draw();};draw();
}
async function init() {
  try { state.games=await api("/api/games"); } catch(e) { toast("Could not load the game library."); return; }
  renderCategories(); renderGames();
  try { const data=await api("/api/auth/me"); state.user=data.user; } catch {}
  updateAccountButton(); if(state.user) await loadProgress();
}
$("#searchInput").addEventListener("input",e=>{state.query=e.target.value;renderGames();});
$("#accountBtn").addEventListener("click",()=>state.user?openProfile():accountModal());
function openProfile() {
  openModal(`<h2 id="modalTitle">Player profile</h2><p>Signed in as <b>${esc(state.user.username)}</b>. Your saved progress is linked to this account.</p><div class="game-actions"><button id="signOutBtn">Sign out</button></div>`);
  $("#signOutBtn").onclick=async()=>{try{await api("/api/auth/logout",{method:"POST"});state.user=null;state.progress={};updateAccountButton();closeModal();toast("Signed out.");}catch(e){toast(e.message);}};
}
$("#closeModal").addEventListener("click",closeModal);
$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal();});
$("#exploreBtn").onclick=()=>$("#games").scrollIntoView({behavior:"smooth"});
$("#clickerBtn").onclick=()=>{state.category="Clicker";renderCategories();renderGames();$("#games").scrollIntoView({behavior:"smooth"});};
$("#allClickersBtn").onclick=$("#clickerBtn").onclick;
$("#backTopBtn").onclick=()=>window.scrollTo({top:0,behavior:"smooth"});
$("#menuBtn").onclick=()=>{const nav=document.querySelector(".desktop-nav");nav.style.display=nav.style.display==="flex"?"none":"flex";nav.style.position="absolute";nav.style.top="65px";nav.style.right="20px";nav.style.padding="18px";nav.style.background="#0d1726";nav.style.border="1px solid #294769";nav.style.borderRadius="12px";nav.style.flexDirection="column";};
document.querySelectorAll("[data-view]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();const v=a.dataset.view;if(v==="clickers"){$("#clickers").scrollIntoView({behavior:"smooth"});state.category="Clicker";}else if(v==="games"){$("#games").scrollIntoView({behavior:"smooth"});state.category="All";}else window.scrollTo({top:0,behavior:"smooth"});renderCategories();renderGames();}));
document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#searchInput").focus();}if(e.key==="Escape")closeModal();});
init();
