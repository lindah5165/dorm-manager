// Dorm Manager starter prototype
// Data is saved in this browser with localStorage. A shared database will be added later.

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

let shopping = load("dm-shopping", [
  { id: 1, name: "Paper towels", lastBought: "Jordan", nextBuyer: "Linda", status: "Needed" },
  { id: 2, name: "Dish soap", lastBought: "Linda", nextBuyer: "Alex", status: "Claimed" },
  { id: 3, name: "Trash bags", lastBought: "Sam", nextBuyer: "Anyone", status: "Needed" }
]);
let chores = load("dm-chores", [
  { id: 1, name: "Take out the trash", assigned: "Linda", due: "Today", status: "Pending" },
  { id: 2, name: "Wipe kitchen counters", assigned: "Linda", due: "Friday", status: "Pending" },
  { id: 3, name: "Clean the bathroom", assigned: "Alex", due: "Wednesday", status: "Pending" },
  { id: 4, name: "Vacuum common area", assigned: "Jordan", due: "Saturday", status: "Complete" }
]);
let expenses = load("dm-expenses", []);
let announcements = load("dm-announcements", [
  { title: "Maintenance visit this Wednesday", body: "Maintenance will be stopping by to check the kitchen sink at 2:00 PM. Please make sure the area is clear.", date: "Posted yesterday" }
]);
let suggestions = load("dm-suggestions", []);
let messages = load("dm-messages", []);

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
}
function openDialog(id) { document.getElementById(id).showModal(); }
function closeDialog(id) { document.getElementById(id).close(); }

function navigate(page) {
  $$(".page").forEach(p => p.classList.toggle("active", p.id === `page-${page}`));
  $$(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  const active = $(`.nav-link[data-page="${page}"]`);
  $("#breadcrumb-current").textContent = active ? active.textContent.trim() : page;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$$("[data-page]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.page)));

$$(".tabs").forEach(tabBar => {
  tabBar.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
    const container = tabBar.parentElement;
    tabBar.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
    container.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === tab.dataset.tab));
  }));
});

$$("[data-close]").forEach(button => button.addEventListener("click", () => closeDialog(button.dataset.close)));
$("#add-item-open").addEventListener("click", () => openDialog("item-dialog"));
$("#add-chore-open").addEventListener("click", () => openDialog("chore-dialog"));
$("#add-expense-open").addEventListener("click", () => openDialog("expense-dialog"));
$("#announcement-open").addEventListener("click", () => openDialog("announcement-dialog"));

function renderShopping() {
  const list = $("#shopping-list");
  list.innerHTML = shopping.length ? shopping.map(item => `
    <div class="table-row shopping-row">
      <div><strong>${escapeHtml(item.name)}</strong><small>Household essential</small></div>
      <div>${escapeHtml(item.lastBought || "Not yet")}</div>
      <div><select class="buyer-select" data-buyer="${item.id}">${["Anyone","Linda","Alex","Jordan","Sam"].map(n => `<option ${item.nextBuyer === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div><span class="status ${item.status.toLowerCase()}">${item.status}</span></div>
      <div><button class="row-action" data-purchase="${item.id}">${item.status === "Purchased" ? "Purchased ✓" : "Mark bought"}</button></div>
    </div>`).join("") : `<div class="empty-row">Your shopping list is empty. Add an item to get started.</div>`;
  $("#needs-total").textContent = `${shopping.filter(i => i.status !== "Purchased").length} items`;
  $("#shopping-count").textContent = shopping.filter(i => i.status !== "Purchased").length;
  $("#dashboard-shopping").innerHTML = shopping.slice(0,3).map(i => `<div><span>${escapeHtml(i.name)}</span><small>Next: ${escapeHtml(i.nextBuyer)}</small></div><span class="mini-status">${i.status}</span>`).join("") || "<p class='muted'>No items yet.</p>";
  $$("[data-buyer]").forEach(select => select.addEventListener("change", e => {
    const item = shopping.find(i => i.id === Number(e.target.dataset.buyer));
    item.nextBuyer = e.target.value; save("dm-shopping", shopping); toast(`${item.name}: next buyer updated.`);
  }));
  $$("[data-purchase]").forEach(button => button.addEventListener("click", () => {
    const item = shopping.find(i => i.id === Number(button.dataset.purchase));
    if (item.status === "Purchased") return toast("This item is already marked purchased.");
    item.lastBought = item.nextBuyer === "Anyone" ? "Linda" : item.nextBuyer;
    item.status = "Purchased";
    save("dm-shopping", shopping); renderShopping(); toast(`${item.name} marked as purchased.`);
  }));
}
$("#item-form").addEventListener("submit", e => {
  e.preventDefault();
  shopping.push({ id: Date.now(), name: $("#item-name").value.trim(), lastBought: "Not yet", nextBuyer: $("#item-buyer").value, status: "Needed" });
  save("dm-shopping", shopping); e.target.reset(); closeDialog("item-dialog"); renderShopping(); toast("Shopping item added.");
});

function renderChores() {
  $("#chore-list").innerHTML = chores.map(chore => `<div class="table-row"><div><strong>${escapeHtml(chore.name)}</strong><small>Household chore</small></div><div>${escapeHtml(chore.assigned)}</div><div>${escapeHtml(chore.due)}</div><div><span class="status ${chore.status.toLowerCase()}">${chore.status}</span></div><div><button class="row-action" data-chore="${chore.id}">${chore.status === "Complete" ? "Undo" : "Complete"}</button></div></div>`).join("");
  $("#dashboard-chores").innerHTML = chores.filter(c => c.assigned === "Linda" && c.status !== "Complete").slice(0,2).map(c => `<div class="compact-item"><span class="empty-check"></span><span><strong>${escapeHtml(c.name)}</strong><small>Due ${escapeHtml(c.due)}</small></span></div>`).join("") || "<p class='muted'>You're all caught up!</p>";
  $("#chore-count").textContent = chores.filter(c => c.assigned === "Linda" && c.status !== "Complete").length;
  $$("[data-chore]").forEach(btn => btn.addEventListener("click", () => {
    const chore = chores.find(c => c.id === Number(btn.dataset.chore));
    chore.status = chore.status === "Complete" ? "Pending" : "Complete";
    save("dm-chores", chores); renderChores(); toast("Chore status updated.");
  }));
}
$("#chore-form").addEventListener("submit", e => {
  e.preventDefault();
  chores.push({ id: Date.now(), name: $("#chore-name").value.trim(), assigned: $("#chore-assignee").value, due: $("#chore-due").value, status: "Pending" });
  save("dm-chores", chores); e.target.reset(); closeDialog("chore-dialog"); renderChores(); toast("Chore added.");
});
$("#chore-wheel").addEventListener("click", () => {
  const people = ["Linda","Alex","Jordan","Sam"];
  const pending = chores.filter(c => c.status !== "Complete");
  if (!pending.length) return toast("There are no pending chores to assign.");
  pending.forEach((chore, index) => chore.assigned = people[(Math.floor(Math.random() * people.length) + index) % people.length]);
  save("dm-chores", chores); renderChores(); toast("Chores have been randomly reassigned!");
});

const movingItems = load("dm-moving", [
  {name:"Bedding and pillows",done:true,category:"Bedroom"},
  {name:"Towels and shower curtain",done:true,category:"Bathroom"},
  {name:"Plates and utensils",done:true,category:"Kitchen"},
  {name:"Cleaning supplies",done:false,category:"Common area"},
  {name:"Vacuum",done:false,category:"Common area"}
]);
function renderMoving() {
  const done = movingItems.filter(i => i.done).length;
  $("#move-progress").textContent = `${done} / ${movingItems.length} complete`;
  $("#move-progress-bar").style.width = `${done / movingItems.length * 100}%`;
  $("#moving-list").innerHTML = movingItems.map((item,index) => `<label class="moving-item"><input type="checkbox" data-moving="${index}" ${item.done ? "checked" : ""}><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.category)}</small></label>`).join("");
  $$("[data-moving]").forEach(input => input.addEventListener("change", e => { movingItems[Number(e.target.dataset.moving)].done = e.target.checked; save("dm-moving", movingItems); renderMoving(); }));
}

$("#save-wishlist").addEventListener("click", () => {
  const url = $("#wishlist-url").value.trim();
  if (!url) return toast("Paste a wishlist link first.");
  try { new URL(url); } catch { return toast("Please enter a valid link."); }
  save("dm-wishlist", url); $("#wishlist-message").textContent = "Wishlist link saved for this browser."; toast("Wishlist link saved.");
});
const savedWishlist = load("dm-wishlist", "");
if (savedWishlist) { $("#wishlist-url").value = savedWishlist; $("#wishlist-message").textContent = "Your household wishlist link is saved."; }

function renderAnnouncements() {
  $("#announcement-list").innerHTML = announcements.map(a => `<article class="announcement-entry"><span class="pill coral-pill">Household update</span><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.body)}</p><small class="muted">${escapeHtml(a.date)}</small></article>`).join("");
}
$("#announcement-form").addEventListener("submit", e => {
  e.preventDefault(); announcements.unshift({title:$("#announcement-title").value.trim(),body:$("#announcement-body").value.trim(),date:"Posted just now"});
  save("dm-announcements",announcements); e.target.reset(); closeDialog("announcement-dialog"); renderAnnouncements(); toast("Announcement posted.");
});
$("#suggestion-form").addEventListener("submit", e => {
  e.preventDefault(); suggestions.unshift($("#suggestion-input").value.trim()); save("dm-suggestions",suggestions); $("#suggestion-input").value=""; renderSuggestions(); toast("Your anonymous suggestion was submitted.");
});
function renderSuggestions() { $("#suggestion-list").innerHTML = suggestions.map(s => `<div class="suggestion-entry">💡 ${escapeHtml(s)} <small class="muted"> · Anonymous</small></div>`).join(""); }

$("#chat-form").addEventListener("submit", e => {
  e.preventDefault(); const value=$("#chat-input").value.trim(); if(!value)return;
  messages.push(value); save("dm-messages",messages); $("#chat-input").value=""; renderMessages();
});
function renderMessages() {
  const box=$("#chat-messages");
  const existing = messages.map(m => `<div class="chat-message own-message"><div><small>You · just now</small><p>${escapeHtml(m)}</p></div><span class="chat-avatar purple-avatar">LH</span></div>`).join("");
  box.innerHTML = `<div class="chat-message"><span class="chat-avatar coral-avatar">A</span><div><small>Alex · 9:14 AM</small><p>Does anyone need anything from the store?</p></div></div><div class="chat-message own-message"><div><small>You · 9:18 AM</small><p>Could you grab paper towels? I added them to the list!</p></div><span class="chat-avatar purple-avatar">LH</span></div><div class="chat-message"><span class="chat-avatar green-avatar">J</span><div><small>Jordan · 9:22 AM</small><p>I'll take care of the trash bags.</p></div></div>${existing}`;
  box.scrollTop=box.scrollHeight;
}

function renderExpenses() {
  const total=expenses.reduce((sum,e)=>sum+Number(e.amount),0);
  const month=expenses.filter(e=>e.date.slice(0,7)===new Date().toISOString().slice(0,7)).reduce((sum,e)=>sum+Number(e.amount),0);
  $("#expense-total").textContent=`$${total.toFixed(2)}`; $("#expense-month").textContent=`$${month.toFixed(2)}`; $("#expense-count").textContent=expenses.length;
  $("#expense-list").innerHTML=expenses.length ? expenses.map(e=>`<div class="table-row expense-row"><div><strong>${escapeHtml(e.name)}</strong><small>Household purchase</small></div><div>${escapeHtml(e.buyer)}</div><div>${escapeHtml(e.date)}</div><div><strong>$${Number(e.amount).toFixed(2)}</strong></div></div>`).join("") : `<div class="empty-row" style="padding:25px;text-align:center;color:#858499;font-size:11px">No purchases recorded yet. Add one to start your household history.</div>`;
}
$("#expense-form").addEventListener("submit", e => {
  e.preventDefault(); expenses.unshift({name:$("#expense-name").value.trim(),buyer:$("#expense-buyer").value,amount:Number($("#expense-amount").value),date:$("#expense-date").value});
  save("dm-expenses",expenses); e.target.reset(); closeDialog("expense-dialog"); renderExpenses(); toast("Purchase saved.");
});

function renderCalendar() {
  const grid=$("#calendar-grid");
  const days=["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const cells=days.map(d=>`<div class="calendar-day head">${d}</div>`);
  const offset=4; // October 2026 starts on Thursday
  for(let i=0;i<offset;i++) cells.push(`<div class="calendar-day"></div>`);
  for(let day=1;day<=31;day++) {
    let events="";
    if(day===14) events='<div class="calendar-event">Roommate check-in</div>';
    if(day===15) events='<div class="calendar-event orange-event">Trash pickup</div>';
    if(day===21) events='<div class="calendar-event">Maintenance</div>';
    cells.push(`<div class="calendar-day ${day===12?"today":""}"><span class="day-number">${day}</span>${events}</div>`);
  }
  grid.innerHTML=cells.join("");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

const today = new Date();
$("#today-label").textContent = today.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
$("#chore-due").value = today.toISOString().slice(0,10);
$("#expense-date").value = today.toISOString().slice(0,10);
renderShopping(); renderChores(); renderMoving(); renderAnnouncements(); renderSuggestions(); renderMessages(); renderExpenses(); renderCalendar();
