/* Dorm Manager - shared household application.
   Requires config.js with Supabase URL and anon key. */
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const config = window.DORM_CONFIG || {};
  let supabase = null, user = null, profile = null, household = null, members = [];
  let authMode = "login", currentPage = "dashboard", currentTab = "shopping";
  let dialogTable = "", editingId = null, cached = {};
  const pageTitles = {dashboard:"Dashboard",calendar:"Calendar & Tasks",shopping:"Household Needs",communication:"Communication",expenses:"Expenses",household:"Profile & Household",settings:"Settings"};
  const tableLabels = {
    chores:{title:"Chores", fields:[["title","Chore name","text",true],["assigned_to","Assigned to","member"],["due_date","Due date","date"],["frequency","Repeat","select",false,["Once","Daily","Weekly","Monthly"]],["status","Status","select",false,["To do","In progress","Done"]],["notes","Notes","textarea"]]},
    events:{title:"Calendar events",fields:[["title","Event title","text",true],["event_date","Date and time","datetime-local",true],["location","Location","text"],["description","Details","textarea"]]},
    shopping_items:{title:"Shopping items",fields:[["name","Item","text",true],["quantity","Quantity / notes","text"],["added_by","Added by","member"],["next_buyer","Next planned buyer","member"],["status","Status","select",false,["Needed","Claimed","Purchased"]]]},
    moving_items:{title:"Moving-in checklist",fields:[["name","Item","text",true],["category","Room","select",true,["Bedroom","Bathroom","Kitchen","Common Area","Other"]],["assigned_to","Assigned to","member"],["status","Status","select",false,["Needed","In progress","Purchased","Packed"]],["notes","Notes","textarea"]]},
    expenses:{title:"Expenses",fields:[["description","Description","text",true],["amount","Amount ($)","number",true],["paid_by","Paid by","member"],["category","Category","select",false,["Groceries","Utilities","Supplies","Furniture","Other"]],["expense_date","Date","date",true],["notes","Notes","textarea"]]},
    announcements:{title:"Announcements",fields:[["title","Title","text",true],["body","Announcement","textarea",true]]},
    suggestions:{title:"Suggestions",fields:[["title","Suggestion","text",true],["body","Details","textarea"],["anonymous","Post anonymously","checkbox"]]},
    messages:{title:"Message",fields:[["body","Message","textarea",true]]},
    household_contacts:{title:"Household contacts",fields:[["name","Contact name","text",true],["role","Role","text"],["phone","Phone","tel"],["email","Email","email"],["notes","Notes","textarea"]]},
    wishlist_links:{title:"Wishlist links",fields:[["title","Link name","text",true],["url","URL","url",true],["notes","Notes","textarea"]]}
  };
  const memberName = id => members.find(m=>m.user_id===id)?.display_name || (id===user?.id ? profile?.full_name : "") || "Not assigned";
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = v => v ? new Date(v).toLocaleString([], {dateStyle:"medium", ...(String(v).includes("T")?{timeStyle:"short"}:{})}) : "—";
  function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
  function notice(msg){const el=$("#notice");el.textContent=msg;el.classList.toggle("hidden",!msg)}
  function requireHousehold(){if(!household){notice("Create a household or join one to start using shared features.");return false}notice("");return true}
  async function db(table){if(!requireHousehold())return [];const {data,error}=await supabase.from(table).select("*").eq("household_id",household.id).order("created_at",{ascending:false});if(error){toast(error.message);return []}cached[table]=data||[];return cached[table]}
  async function save(table,payload,id){let q=supabase.from(table);const row={...payload,household_id:household.id};const result=id?await q.update(row).eq("id",id).select().single():await q.insert(row).select().single();if(result.error)throw result.error;return result.data}
  async function remove(table,id){const {error}=await supabase.from(table).delete().eq("id",id);if(error)throw error}
  function empty(msg){return `<div class="empty">${esc(msg)}</div>`}
  function pageHead(title,desc,button,label){return `<div class="page-heading"><div><h3>${title}</h3><p>${desc}</p></div>${button?`<button class="primary" data-add="${button}">+ ${label||"Add new"}</button>`:""}</div>`}
  function tableView(rows,cols,table){if(!rows.length)return empty("Nothing here yet. Add your first item to get started.");return `<div class="table-wrap"><table class="data-table"><thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join("")}<th>ACTIONS</th></tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${c[2]?c[2](r):esc(r[c[0]]||"—")}</td>`).join("")}<td><div class="row-actions"><button class="small-btn" data-edit="${table}:${r.id}">Edit</button><button class="small-btn" data-delete="${table}:${r.id}">Delete</button></div></td></tr>`).join("")}</tbody></table></div>`}
  function panel(title,body,extra=""){return `<section class="panel"><div class="panel-head"><h3>${title}</h3>${extra}</div>${body}</section>`}
  function listRows(rows,render){return rows.length?`<div class="list">${rows.map(render).join("")}</div>`:empty("Nothing to show yet.")}
  async function render(){
    $("#pageTitle").textContent=pageTitles[currentPage];$("#pageEyebrow").textContent="YOUR HOUSEHOLD";$$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===currentPage));
    $("#sideHousehold").textContent=household?.name||"No household yet";
    if(currentPage==="dashboard")return dashboard();
    if(currentPage==="calendar")return calendarPage();
    if(currentPage==="shopping")return shoppingPage();
    if(currentPage==="communication")return communicationPage();
    if(currentPage==="expenses")return expensesPage();
    if(currentPage==="household")return householdPage();
    if(currentPage==="settings")return settingsPage();
  }
  async function dashboard(){
    if(!requireHousehold()){$("#pageContent").innerHTML=pageHead("Welcome to Dorm Manager","Create a household or join one to begin.","household","Set up household");return}
    const [chores,events,shopping,ann]=await Promise.all(["chores","events","shopping_items","announcements"].map(db));
    const myChores=chores.filter(x=>x.assigned_to===user.id&&x.status!=="Done");
    const upcoming=events.filter(x=>new Date(x.event_date)>=new Date()).sort((a,b)=>new Date(a.event_date)-new Date(b.event_date)).slice(0,4);
    const needed=shopping.filter(x=>x.status!=="Purchased").slice(0,4);
    $("#pageContent").innerHTML=`<section class="welcome"><span class="eyebrow">YOUR HOUSEHOLD</span><h3>Welcome back, ${esc(profile?.full_name?.split(" ")[0]||"roommate")}!</h3><p>Here's what's happening in ${esc(household.name)}.</p></section>
    <div class="grid stats"><div class="stat"><small>My open chores</small><strong>${myChores.length}</strong></div><div class="stat"><small>Items still needed</small><strong>${shopping.filter(x=>x.status!=="Purchased").length}</strong></div><div class="stat"><small>Household members</small><strong>${members.length}</strong></div></div>
    <div class="grid two-col">${panel("My upcoming chores",listRows(myChores.slice(0,5),x=>`<div class="list-row"><div class="row-main"><b>${esc(x.title)}</b><small>Due ${fmtDate(x.due_date)}</small></div><span class="pill">${esc(x.status)}</span></div>`),`<button class="text-button" data-page="calendar">View all</button>`)}
    ${panel("Upcoming events",listRows(upcoming,x=>`<div class="list-row"><div class="row-main"><b>${esc(x.title)}</b><small>${fmtDate(x.event_date)}</small></div></div>`),`<button class="text-button" data-page="calendar">Calendar</button>`)}
    ${panel("Household needs",listRows(needed,x=>`<div class="list-row"><div class="row-main"><b>${esc(x.name)}</b><small>Next buyer: ${esc(memberName(x.next_buyer)||"Not assigned")}</small></div><span class="pill warn">${esc(x.status)}</span></div>`),`<button class="text-button" data-page="shopping">Shopping list</button>`)}
    ${panel("Latest announcements",listRows(ann.slice(0,3),x=>`<div class="list-row"><div class="row-main"><b>${esc(x.title)}</b><small>${esc(x.body)}</small></div></div>`),`<button class="text-button" data-page="communication">View all</button>`)}</div>`;
  }
  async function calendarPage(){
    if(!requireHousehold())return;
    const [events,chores]=await Promise.all([db("events"),db("chores")]);
    $("#pageContent").innerHTML=`<div class="tabs"><button class="tab ${currentTab==="calendar"?"active":""}" data-tab="calendar">Calendar</button><button class="tab ${currentTab==="chores"?"active":""}" data-tab="chores">Chores</button></div>
    ${currentTab==="calendar"?pageHead("Household calendar","Keep track of shared plans and important dates.","events","Add event"):pageHead("Chore assignments","Assign tasks, set due dates, and track completion.","chores","Add chore")}
    ${currentTab==="calendar"?tableView(events,[["title","EVENT"],["event_date","DATE",r=>fmtDate(r.event_date)],["location","LOCATION"],["description","DETAILS"]],"events"):
    tableView(chores,[["title","CHORE"],["assigned_to","ASSIGNED TO",r=>esc(memberName(r.assigned_to))],["due_date","DUE",r=>fmtDate(r.due_date)],["frequency","REPEAT"],["status","STATUS",r=>`<span class="pill ${r.status==="Done"?"done":""}">${esc(r.status)}</span>`]],"chores")}`;
  }
  async function shoppingPage(){
    if(!requireHousehold())return;
    const [items,moving,wishlist,purchases]=await Promise.all([db("shopping_items"),db("moving_items"),db("wishlist_links"),db("shopping_purchases")]);
    const tabs=[["shopping","Shopping"],["moving","Moving In"],["wishlist","Wishlist"]];
    let body="";
    if(currentTab==="shopping"){
      const rows=items.map(r=>({...r,_last:r.last_bought_by?memberName(r.last_bought_by):"Not purchased yet"}));
      body=pageHead("Shopping list","Track household supplies, who bought them last, and who plans to buy them next.","shopping_items","Add item")+tableView(rows,[["name","ITEM"],["quantity","QUANTITY / NOTES"],["_last","LAST BOUGHT BY"],["next_buyer","NEXT BUYER",r=>esc(memberName(r.next_buyer)||"Not assigned")],["status","STATUS",r=>`<span class="pill ${r.status==="Purchased"?"done":""}">${esc(r.status)}</span>`]],"shopping_items");
      body+=`<p class="tiny muted">Use Edit to assign the next buyer. Mark an item purchased to add it to the purchase history.</p><div style="height:18px"></div>${panel("Purchase history",listRows(purchases.slice(0,8),x=>`<div class="list-row"><div class="row-main"><b>${esc(x.item_name)}</b><small>${esc(x.quantity||"")} · Bought by ${esc(memberName(x.purchased_by))}</small></div><small class="muted">${fmtDate(x.purchased_at)}</small></div>`))}`;
    }else if(currentTab==="moving"){
      const done=moving.filter(x=>["Purchased","Packed"].includes(x.status)).length;
      body=pageHead("Moving-in checklist","Organize what your household needs by room.","moving_items","Add item")+`<div class="panel" style="margin-bottom:15px"><div class="panel-head"><h3>Checklist progress</h3><b>${moving.length?Math.round(done/moving.length*100):0}%</b></div><div class="progress"><span style="width:${moving.length?done/moving.length*100:0}%"></span></div></div>`+tableView(moving,[["name","ITEM"],["category","ROOM"],["assigned_to","ASSIGNED TO",r=>esc(memberName(r.assigned_to)||"Not assigned")],["status","STATUS"]],"moving_items");
    }else{
      body=pageHead("Shared wishlist","Keep useful links to items your household may want.","wishlist_links","Add link")+listRows(wishlist,x=>`<div class="list-row"><div class="row-main"><b>${esc(x.title)}</b><small>${esc(x.notes||x.url)}</small><a class="muted-link" href="${esc(x.url)}" target="_blank" rel="noopener">Open link ↗</a></div><div class="row-actions"><button class="small-btn" data-edit="wishlist_links:${x.id}">Edit</button><button class="small-btn" data-delete="wishlist_links:${x.id}">Delete</button></div></div>`);
    }
    $("#pageContent").innerHTML=`<div class="tabs">${tabs.map(([id,n])=>`<button class="tab ${currentTab===id?"active":""}" data-tab="${id}">${n}</button>`).join("")}</div>${body}`;
  }
  async function communicationPage(){
    if(!requireHousehold())return;
    const [ann,sug,msg]=await Promise.all(["announcements","suggestions","messages"].map(db));
    $("#pageContent").innerHTML=`<div class="tabs">${[["messages","Messages"],["announcements","Announcements"],["suggestions","Suggestions"]].map(([id,n])=>`<button class="tab ${currentTab===id?"active":""}" data-tab="${id}">${n}</button>`).join("")}</div>
    ${currentTab==="announcements"?pageHead("Announcements","Important updates for everyone in the household.","announcements","Post announcement")+listRows(ann,x=>`<div class="list-row"><div class="row-main"><b>${esc(x.title)}</b><small>${esc(x.body)} · ${fmtDate(x.created_at)}</small></div><div class="row-actions"><button class="small-btn" data-edit="announcements:${x.id}">Edit</button><button class="small-btn" data-delete="announcements:${x.id}">Delete</button></div></div>`):
    currentTab==="suggestions"?pageHead("Suggestions","Share ideas to make your household work better.","suggestions","Add suggestion")+listRows(sug,x=>`<div class="list-row"><div class="row-main"><b>${esc(x.title)}</b><small>${esc(x.anonymous?"Anonymous":memberName(x.created_by))} · ${esc(x.body||"")}</small></div><div class="row-actions">${x.created_by===user.id?`<button class="small-btn" data-delete="suggestions:${x.id}">Delete</button>`:""}</div></div>`):
    `<div class="page-heading"><div><h3>Household messages</h3><p>Messages are visible to household members.</p></div></div><div class="chat-box" id="chatBox">${msg.slice().reverse().map(x=>`<div class="chat-message ${x.created_by===user.id?"mine":""}">${esc(x.body)}<small>${esc(memberName(x.created_by))} · ${fmtDate(x.created_at)}</small></div>`).join("")||empty("No messages yet. Start the conversation.")}</div><form id="chatForm" class="inline-form"><input name="body" placeholder="Write a message..." required><button class="primary">Send</button></form>`}`;
  }
  async function expensesPage(){
    if(!requireHousehold())return;
    const rows=await db("expenses"),sum=rows.reduce((a,x)=>a+Number(x.amount||0),0);
    $("#pageContent").innerHTML=pageHead("Household expenses","Keep a shared record of household spending.","expenses","Add expense")+`<div class="grid stats"><div class="stat"><small>Total recorded expenses</small><strong>$${sum.toFixed(2)}</strong></div><div class="stat"><small>Number of expenses</small><strong>${rows.length}</strong></div><div class="stat"><small>Household members</small><strong>${members.length}</strong></div></div>`+tableView(rows,[["description","DESCRIPTION"],["amount","AMOUNT",r=>`$${Number(r.amount).toFixed(2)}`],["paid_by","PAID BY",r=>esc(memberName(r.paid_by)||"Not assigned")],["category","CATEGORY"],["expense_date","DATE",r=>fmtDate(r.expense_date)]],"expenses");
  }
  async function householdPage(){
    const contacts=household?await db("household_contacts"):[];
    if(!household){
      $("#pageContent").innerHTML=`<div class="grid two-col"><section class="panel"><h3>Create a household</h3><p class="muted">Start a shared space and invite roommates with a household code.</p><form id="createHousehold" class="stack"><label>Household name<input name="name" placeholder="e.g. Maple Street House" required></label><label>Location (optional)<input name="location" placeholder="Building or neighborhood"></label><button class="primary">Create household</button></form></section><section class="panel"><h3>Join a household</h3><p class="muted">Enter the invite code shared by your roommate.</p><form id="joinHousehold" class="stack"><label>Invite code<input name="code" placeholder="Enter code" required></label><button class="primary">Join household</button></form></section></div>`;
      return;
    }
    $("#pageContent").innerHTML=`<div class="grid two-col"><section class="panel"><div class="panel-head"><h3>Household overview</h3></div><p><b>${esc(household.name)}</b></p><p class="muted">${esc(household.location||"No location added")}</p><p class="tiny muted">Invite code</p><div class="inline-form"><input readonly value="${esc(household.invite_code)}" id="inviteCode"><button class="button" id="copyCode">Copy</button></div><p class="tiny muted">Share this code only with people you want to add to your household.</p></section>
    <section class="panel"><h3>Members</h3>${listRows(members,m=>`<div class="list-row"><div class="avatar">${esc((m.display_name||"U").charAt(0).toUpperCase())}</div><div class="row-main"><b>${esc(m.display_name||"Roommate")}</b><small>${esc(m.role||"member")}</small></div></div>`)}</section></div>
    <div style="height:16px"></div>${pageHead("Household contacts","Useful contacts such as your RA, maintenance, or housing office.","household_contacts","Add contact")}${tableView(contacts,[["name","NAME"],["role","ROLE"],["phone","PHONE"],["email","EMAIL"],["notes","NOTES"]],"household_contacts")}
    <div class="panel" style="margin-top:16px"><h3>Household details</h3><p class="muted tiny">To change the household name or location, use the edit controls below.</p><button class="button" id="editHousehold">Edit household details</button></div>`;
  }
  function settingsPage(){
    $("#pageContent").innerHTML=`<div class="grid settings-grid"><section class="panel"><h3>My profile</h3><form id="profileForm" class="stack"><label>Full name<input name="full_name" value="${esc(profile?.full_name||"")}" required></label><label>Email<input value="${esc(user.email)}" disabled></label><button class="primary">Save profile</button></form></section><section class="panel"><h3>Account</h3><p class="muted">Signed in as ${esc(user.email)}.</p><button class="button" id="resetPassword">Send password reset email</button><p class="tiny muted">Notification preferences and household rules can be added to this section as your project develops.</p></section></div>`;
  }
  function openForm(table,row=null){
    if(!requireHousehold())return;
    dialogTable=table;editingId=row?.id||null;const spec=tableLabels[table];$("#dialogTitle").textContent=(row?"Edit ":"Add ")+spec.title.toLowerCase();$("#dialogFields").innerHTML=spec.fields.map(([key,label,type,required,opts])=>{
      const val=row?.[key]??(key==="status"?(table==="chores"?"To do":table==="shopping_items"||table==="moving_items"?"Needed":""):"");
      let field="";
      if(type==="member")field=`<select name="${key}"><option value="">Not assigned</option>${members.map(m=>`<option value="${m.user_id}" ${val===m.user_id?"selected":""}>${esc(m.display_name)}</option>`).join("")}</select>`;
      else if(type==="select")field=`<select name="${key}">${(opts||[]).map(o=>`<option ${val===o?"selected":""}>${esc(o)}</option>`).join("")}</select>`;
      else if(type==="textarea")field=`<textarea name="${key}">${esc(val)}</textarea>`;
      else if(type==="checkbox")field=`<input name="${key}" type="checkbox" ${val?"checked":""}>`;
      else field=`<input name="${key}" type="${type}" value="${esc(val)}" ${required?"required":""} ${type==="number"?'min="0" step="0.01"':""}>`;
      return `<label class="${type==="textarea"?"wide":""}">${label}${field}</label>`;
    }).join("");
    $("#itemDialog").showModal();
  }
  async function submitItem(form){
    const data=Object.fromEntries(new FormData(form).entries());
    for(const [k,v] of Object.entries(data)){if(k==="amount")data[k]=Number(v);if(k==="anonymous")data[k]=true;}
    if(dialogTable==="suggestions")data.created_by=user.id;
    if(dialogTable==="messages")data.created_by=user.id;
    if(dialogTable==="shopping_items"&&data.status==="Purchased"&&!editingId){data.last_bought_by=user.id;}
    if(dialogTable==="chores"&&data.status==="Done")data.completed_at=new Date().toISOString();
    try{await save(dialogTable,data,editingId);$("#itemDialog").close();toast("Saved successfully.");await render()}catch(e){toast(e.message||"Could not save item.")};
  }
  async function handleDelete(table,id){if(!confirm("Delete this item?"))return;try{await remove(table,id);toast("Deleted.");await render()}catch(e){toast(e.message)}}
  async function markPurchased(id){
    try{
      const item=(cached.shopping_items||[]).find(x=>x.id===id);if(!item)return;
      const {error}=await supabase.from("shopping_items").update({status:"Purchased",last_bought_by:user.id,purchased_at:new Date().toISOString()}).eq("id",id);
      if(error)throw error;
      await supabase.from("shopping_purchases").insert({household_id:household.id,item_name:item.name,quantity:item.quantity||"",purchased_by:user.id});
      toast("Marked as purchased and added to purchase history.");await render();
    }catch(e){toast(e.message)}
  }
  async function loadHousehold(){
    const {data:mem}=await supabase.from("household_members").select("household_id,role").eq("user_id",user.id).limit(1).maybeSingle();
    if(mem){const {data:h}=await supabase.from("households").select("*").eq("id",mem.household_id).single();household=h;await loadMembers()}
    else household=null;
  }
  async function loadMembers(){
    if(!household)return;
    const {data:rows}=await supabase.from("household_members").select("user_id,role,profiles(full_name)").eq("household_id",household.id);
    members=(rows||[]).map(x=>({user_id:x.user_id,role:x.role,display_name:x.profiles?.full_name||"Roommate"}));
  }
  async function loadProfile(){const {data}=await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();profile=data||{full_name:user.email?.split("@")[0]};}
  async function afterLogin(session){
    user=session.user;await loadProfile();await loadHousehold();
    $("#authScreen").classList.add("hidden");$("#app").classList.remove("hidden");
    $("#userName").textContent=profile.full_name||"User";$("#userEmail").textContent=user.email;$("#userAvatar").textContent=(profile.full_name||"U").charAt(0).toUpperCase();
    $("#todayLabel").textContent=new Date().toLocaleDateString([], {weekday:"short",month:"short",day:"numeric"});
    await render();
  }
  function authMessage(t){$("#authMessage").textContent=t}
  async function init(){
    if(!config.SUPABASE_URL||!config.SUPABASE_ANON_KEY||config.SUPABASE_URL.includes("YOUR-PROJECT")){
      $("#authMessage").textContent="Setup needed: copy config.example.js to config.js and add your Supabase project URL and anon key.";return;
    }
    supabase=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY);
    const {data:{session}}=await supabase.auth.getSession();if(session)await afterLogin(session);
    supabase.auth.onAuthStateChange((_event,s)=>{if(s)afterLogin(s);else{user=null;$("#app").classList.add("hidden");$("#authScreen").classList.remove("hidden")}});
  }
  document.addEventListener("click",async e=>{
    const page=e.target.closest("[data-page]");if(page){currentPage=page.dataset.page;$("#sidebar").classList.remove("open");await render();return}
    const tab=e.target.closest("[data-tab]");if(tab){currentTab=tab.dataset.tab;await render();return}
    const add=e.target.closest("[data-add]");if(add){openForm(add.dataset.add);return}
    const edit=e.target.closest("[data-edit]");if(edit){const [table,id]=edit.dataset.edit.split(":");openForm(table,(cached[table]||[]).find(x=>x.id===id));return}
    const del=e.target.closest("[data-delete]");if(del){const [table,id]=del.dataset.delete.split(":");await handleDelete(table,id);return}
    const purchased=e.target.closest("[data-purchased]");if(purchased){await markPurchased(purchased.dataset.purchased);return}
  });
  // Add purchase action to shopping table rows after rendering.
  const observer=new MutationObserver(()=>{$$("#pageContent tr").forEach(tr=>{const edit=tr.querySelector('[data-edit^="shopping_items:"]');if(edit&&!tr.querySelector("[data-purchased]")){const id=edit.dataset.edit.split(":")[1];const status=tr.children[4]?.textContent;if(status==="Purchased")return;const b=document.createElement("button");b.className="small-btn";b.textContent="Purchased";b.dataset.purchased=id;tr.querySelector(".row-actions").prepend(b)}})});
  observer.observe($("#pageContent"),{childList:true,subtree:true});
  $("#authForm").addEventListener("submit",async e=>{e.preventDefault();const email=$("#authEmail").value.trim(),password=$("#authPassword").value,name=$("#authName").value.trim();$("#authSubmit").disabled=true;try{
    if(authMode==="signup"){const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name}}});if(error)throw error;if(data.session){await supabase.from("profiles").upsert({id:data.user.id,full_name:name});authMessage("Account created.");}else authMessage("Check your email to confirm your account, then log in.");}
    else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;}
  }catch(err){authMessage(err.message)}finally{$("#authSubmit").disabled=false}});
  $$("[data-auth-tab]").forEach(b=>b.addEventListener("click",()=>{authMode=b.dataset.authTab;$$("[data-auth-tab]").forEach(x=>x.classList.toggle("active",x===b));$("#nameWrap").classList.toggle("hidden",authMode!=="signup");$("#authSubmit").textContent=authMode==="signup"?"Create account":"Log in";$("#authPassword").autocomplete=authMode==="signup"?"new-password":"current-password";authMessage("")}));
  $("#logoutBtn").addEventListener("click",()=>supabase.auth.signOut());
  $("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#dialogClose").addEventListener("click",()=>$("#itemDialog").close());$("#dialogCancel").addEventListener("click",()=>$("#itemDialog").close());
  $("#itemForm").addEventListener("submit",e=>{e.preventDefault();submitItem(e.currentTarget)});
  $("#pageContent").addEventListener("submit",async e=>{
    if(e.target.id==="createHousehold"){e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{const {data,error}=await supabase.rpc("create_household",{household_name:d.name,household_location:d.location||null});if(error)throw error;await loadHousehold();toast("Household created.");await render()}catch(err){toast(err.message)}}
    if(e.target.id==="joinHousehold"){e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{const {error}=await supabase.rpc("join_household",{invite_code_input:d.code.trim().toUpperCase()});if(error)throw error;await loadHousehold();toast("You joined the household.");await render()}catch(err){toast(err.message)}}
    if(e.target.id==="chatForm"){e.preventDefault();try{await save("messages",{body:new FormData(e.target).get("body"),created_by:user.id});await render()}catch(err){toast(err.message)}}
    if(e.target.id==="profileForm"){e.preventDefault();const full_name=new FormData(e.target).get("full_name");try{const {error}=await supabase.from("profiles").upsert({id:user.id,full_name});if(error)throw error;profile={...profile,full_name};$("#userName").textContent=full_name;toast("Profile updated.")}catch(err){toast(err.message)}}
  });
  $("#pageContent").addEventListener("click",async e=>{
    if(e.target.id==="copyCode"){await navigator.clipboard.writeText($("#inviteCode").value);toast("Invite code copied.");}
    if(e.target.id==="editHousehold"){const name=prompt("Household name",household.name);if(name===null)return;const location=prompt("Location",household.location||"");const {error}=await supabase.from("households").update({name,location}).eq("id",household.id);if(error)toast(error.message);else{await loadHousehold();await render();toast("Household updated.")}}
    if(e.target.id==="resetPassword"){const {error}=await supabase.auth.resetPasswordForEmail(user.email);toast(error?error.message:"Password reset email sent.");}
  });
  init();
})();