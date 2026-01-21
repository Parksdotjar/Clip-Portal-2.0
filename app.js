// Setup: paste your Supabase project URL and anon key below. Create a public storage bucket named "clips".
const SUPABASE_URL = "https://zjigjsnrfmqlnypxjerw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqaWdqc25yZm1xbG55cHhqZXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODk5ODcsImV4cCI6MjA4NDU2NTk4N30.ZukZNjGIvn_AHtjEV8gorsj6CmqvhXufHboiGssltYc";

let supabaseClient = null;
const state = {
  user: null,
  session: null
};

let revealObserver = null;

// DOM helpers
const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const page = document.body ? document.body.dataset.page : "";

function getClient() {
  if (supabaseClient) return supabaseClient;
  if (!window.supabase || SUPABASE_URL.includes("PASTE") || SUPABASE_ANON_KEY.includes("PASTE")) {
    return null;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message, type = "success") {
  const container = qs("#toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 3600);
}

// Reusable confirm modal
function initModal() {
  const modal = qs("#modal");
  if (!modal) return;
  const cancel = qs("[data-modal-cancel]", modal);
  const confirm = qs("[data-modal-confirm]", modal);
  let confirmAction = null;

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    confirmAction = null;
  }

  cancel?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  confirm?.addEventListener("click", async () => {
    if (confirmAction) {
      await confirmAction();
    }
    closeModal();
  });

  return function openModal({ title, body, confirmText = "Confirm", onConfirm }) {
    const titleEl = qs("#modal-title");
    const bodyEl = qs("#modal-body");
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body;
    if (confirm) confirm.textContent = confirmText;
    confirmAction = onConfirm;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  };
}

// Auth state drives nav and profile UI
function updateAuthUI(user) {
  qsa("[data-auth='in']").forEach((el) => {
    el.style.display = user ? "" : "none";
  });
  qsa("[data-auth='out']").forEach((el) => {
    el.style.display = user ? "none" : "";
  });

  const profileButton = qs("#profile-button");
  if (profileButton) {
    const letter = user?.email ? user.email.charAt(0).toUpperCase() : "U";
    profileButton.textContent = letter;
  }

  const userEmail = qs("#user-email");
  if (userEmail && user?.email) {
    userEmail.textContent = `Signed in as ${user.email}`;
  }
}

function redirectToLogin(target = "") {
  const param = target ? `?redirect=${encodeURIComponent(target)}` : "";
  window.location.href = `login.html${param}`;
}

// Supabase auth session listener
async function initAuth() {
  const client = getClient();
  if (!client) {
    updateAuthUI(null);
    return;
  }
  const { data, error } = await client.auth.getSession();
  if (error) {
    showToast(error.message, "error");
  }
  state.session = data?.session || null;
  state.user = data?.session?.user || null;
  updateAuthUI(state.user);

  client.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    state.user = session?.user || null;
    updateAuthUI(state.user);

    if (!state.user && (page === "upload" || page === "dashboard")) {
      redirectToLogin(`${page}.html`);
    }
  });
}

function initProfileDropdown() {
  const button = qs("#profile-button");
  const dropdown = qs("#profile-dropdown");
  if (!button || !dropdown) return;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    dropdown.classList.toggle("open");
    button.setAttribute("aria-expanded", dropdown.classList.contains("open"));
  });

  dropdown.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action='logout']");
    if (action) {
      handleLogout();
    }
    dropdown.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target) && event.target !== button) {
      dropdown.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    }
  });
}

async function handleLogout() {
  const client = getClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) {
    showToast(error.message, "error");
    return;
  }
  showToast("Signed out");
  window.location.href = "index.html";
}

function guardAuthLinks() {
  qsa("a[data-requires-auth='true']").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!state.user) {
        event.preventDefault();
        redirectToLogin(link.getAttribute("href"));
      }
    });
  });
}

function initReveal() {
  const elements = qsa(".reveal");
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  elements.forEach((el) => revealObserver.observe(el));
}

function observeReveal(element) {
  if (!element) return;
  if (revealObserver) {
    revealObserver.observe(element);
  } else {
    element.classList.add("is-visible");
  }
}

function applyStagger(container) {
  if (!container) return;
  const children = Array.from(container.children);
  children.forEach((child, index) => {
    child.style.setProperty("--delay", `${index * 80}ms`);
    if (!child.classList.contains("reveal")) {
      child.classList.add("reveal");
    }
    observeReveal(child);
  });
}

// Custom cursor with trailing ring
function initCursor() {
  const dot = qs("#cursor-dot");
  const ring = qs("#cursor-ring");
  if (!dot || !ring) return;

  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  if (isTouch) return;

  document.body.classList.add("custom-cursor");

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  const updatePositions = () => {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    dot.style.left = `${mouseX}px`;
    dot.style.top = `${mouseY}px`;
    ring.style.left = `${ringX}px`;
    ring.style.top = `${ringY}px`;
    requestAnimationFrame(updatePositions);
  };
  updatePositions();

  document.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  const hoverTargets = "a, button, .clip-card";
  document.addEventListener("mouseover", (event) => {
    if (event.target.closest(hoverTargets)) {
      ring.classList.add("hover");
    }
  });
  document.addEventListener("mouseout", (event) => {
    if (event.target.closest(hoverTargets)) {
      ring.classList.remove("hover");
    }
  });

  document.addEventListener("mouseleave", () => {
    dot.classList.add("hidden");
    ring.classList.add("hidden");
  });

  document.addEventListener("mouseenter", () => {
    dot.classList.remove("hidden");
    ring.classList.remove("hidden");
  });
}

// Canvas starfield for depth and parallax
function initStarfield() {
  const canvas = qs("#starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = window.devicePixelRatio || 1;
  const stars = [];
  const starCount = 180;
  let mouseX = width / 2;
  let mouseY = height / 2;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createStar() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.4 + 0.2,
      alpha: Math.random() * 0.6 + 0.2,
      depth: Math.random() * 0.9 + 0.1,
      drift: (Math.random() * 0.4 + 0.2) * (Math.random() > 0.5 ? 1 : -1)
    };
  }

  function populate() {
    stars.length = 0;
    for (let i = 0; i < starCount; i += 1) {
      stars.push(createStar());
    }
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    const parallaxX = (mouseX / width - 0.5) * 36;
    const parallaxY = (mouseY / height - 0.5) * 36;

    for (const star of stars) {
      star.x += star.drift * 0.08;
      if (star.x > width + 20) star.x = -20;
      if (star.x < -20) star.x = width + 20;

      const x = star.x + parallaxX * star.depth;
      const y = star.y + parallaxY * star.depth;
      const radius = star.radius * (1 + star.depth * 0.6);

      ctx.beginPath();
      ctx.fillStyle = `rgba(220, 230, 245, ${star.alpha})`;
      ctx.shadowColor = "rgba(120, 140, 180, 0.35)";
      ctx.shadowBlur = 8 * star.depth;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  resize();
  populate();
  animate();

  window.addEventListener("resize", () => {
    resize();
    populate();
  });

  window.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
}

function renderSkeletons(grid, count = 8) {
  if (!grid) return;
  grid.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const card = document.createElement("div");
    card.className = "clip-card skeleton";
    card.innerHTML = "<div class='clip-media'></div><div class='clip-info'></div>";
    grid.appendChild(card);
  }
}

function buildClipCard(clip, options = {}) {
  const { showDelete = false } = options;
  const card = document.createElement("article");
  card.className = "clip-card";

  const publicUrl = clip.public_url || clip.publicUrl || "";
  const ownerLabel = state.user && clip.owner_id === state.user.id ? "You" : `User ${clip.owner_id?.slice(0, 6)}`;

  card.innerHTML = `
    <div class="clip-media">
      <video src="${publicUrl}" muted loop playsinline preload="metadata"></video>
      <div class="clip-overlay">
        <div class="clip-actions">
          <a class="btn small" href="${publicUrl}" download>Download</a>
          <button class="btn small ghost" type="button" data-copy-url="${publicUrl}">Copy link</button>
          ${showDelete ? `<button class="btn small danger" type="button" data-delete-id="${clip.id}" data-delete-path="${clip.storage_path}">Delete</button>` : ""}
        </div>
      </div>
    </div>
    <div class="clip-info">
      <h4>${escapeHtml(clip.title || "Untitled")}</h4>
      <p>${ownerLabel}</p>
    </div>
  `;

  const video = qs("video", card);
  card.addEventListener("mouseenter", () => {
    video?.play().catch(() => {});
  });
  card.addEventListener("mouseleave", () => {
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  });

  return card;
}

function renderClips(grid, clips, options = {}) {
  if (!grid) return;
  grid.innerHTML = "";

  if (!clips.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state glass";
    empty.textContent = "No clips found.";
    grid.appendChild(empty);
    return;
  }

  clips.forEach((clip, index) => {
    const card = buildClipCard(clip, options);
    card.style.setProperty("--delay", `${index * 80}ms`);
    card.classList.add("reveal");
    grid.appendChild(card);
    observeReveal(card);
  });
}

async function normalizeClips(clips) {
  const client = getClient();
  if (!client) return clips;
  return clips.map((clip) => {
    if (clip.public_url) return clip;
    const { data } = client.storage.from("clips").getPublicUrl(clip.storage_path);
    return { ...clip, public_url: data.publicUrl };
  });
}

// Discover page: load public clips and search
function initDiscover() {
  const grid = qs("#clip-grid");
  const loadMoreButton = qs("#load-more");
  const searchInput = qs("#search-input");

  const client = getClient();
  if (!client) {
    renderClips(grid, []);
    showToast("Connect Supabase in app.js to load clips.", "error");
    return;
  }

  let allClips = [];
  let pageIndex = 0;
  const pageSize = 12;
  let totalCount = null;
  let loading = false;

  async function loadPage({ reset = false } = {}) {
    if (loading) return;
    loading = true;
    if (reset) {
      pageIndex = 0;
      totalCount = null;
      allClips = [];
    }
    renderSkeletons(grid, 8);

    const from = pageIndex * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from("clips")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;
    loading = false;

    if (error) {
      showToast(error.message, "error");
      renderClips(grid, []);
      return;
    }

    totalCount = count;
    const normalized = await normalizeClips(data || []);
    allClips = allClips.concat(normalized);
    renderClips(grid, allClips);
    pageIndex += 1;

    if (totalCount !== null && allClips.length >= totalCount) {
      loadMoreButton?.setAttribute("disabled", "disabled");
      loadMoreButton?.classList.add("is-hidden");
    } else {
      loadMoreButton?.removeAttribute("disabled");
      loadMoreButton?.classList.remove("is-hidden");
    }
  }

  loadMoreButton?.addEventListener("click", () => loadPage());

  searchInput?.addEventListener("input", () => {
    const term = searchInput.value.trim().toLowerCase();
    if (!term) {
      renderClips(grid, allClips);
      if (totalCount !== null && allClips.length < totalCount) {
        loadMoreButton?.removeAttribute("disabled");
      }
      return;
    }
    const filtered = allClips.filter((clip) => (clip.title || "").toLowerCase().includes(term));
    renderClips(grid, filtered);
    loadMoreButton?.setAttribute("disabled", "disabled");
  });

  grid?.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-url]");
    if (copyButton) {
      const url = copyButton.getAttribute("data-copy-url");
      if (url) {
        navigator.clipboard.writeText(url).then(() => {
          showToast("Link copied");
        });
      }
    }
  });

  loadPage();
}

function initLogin() {
  const form = qs("#login-form");
  const errorEl = qs("#login-error");
  const client = getClient();

  if (state.user) {
    window.location.href = "index.html";
    return;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) {
      errorEl.textContent = "Supabase is not configured.";
      return;
    }
    errorEl.textContent = "";

    const email = qs("#login-email").value.trim();
    const password = qs("#login-password").value.trim();

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = error.message;
      return;
    }
    showToast("Welcome back");
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    window.location.href = redirect || "index.html";
  });
}

function initSignup() {
  const form = qs("#signup-form");
  const errorEl = qs("#signup-error");
  const client = getClient();

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) {
      errorEl.textContent = "Supabase is not configured.";
      return;
    }
    errorEl.textContent = "";

    const email = qs("#signup-email").value.trim();
    const password = qs("#signup-password").value.trim();
    const confirm = qs("#signup-confirm").value.trim();

    if (password !== confirm) {
      errorEl.textContent = "Passwords do not match.";
      return;
    }

    const { error } = await client.auth.signUp({ email, password });
    if (error) {
      errorEl.textContent = error.message;
      return;
    }

    showToast("Account created. Check your email to confirm.");
    window.location.href = "index.html";
  });
}

// Upload page: store file and metadata
function initUpload() {
  if (!state.user) {
    redirectToLogin("upload.html");
    return;
  }

  const form = qs("#upload-form");
  const errorEl = qs("#upload-error");
  const progress = qs("#upload-progress");
  const progressFill = qs(".progress-fill", progress);
  const preview = qs("#upload-preview");
  const client = getClient();

  if (!client) {
    errorEl.textContent = "Supabase is not configured.";
    return;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";

    const title = qs("#clip-title").value.trim();
    const tagsRaw = qs("#clip-tags").value.trim();
    const fileInput = qs("#clip-file");
    const file = fileInput.files[0];

    if (!title || !file) {
      errorEl.textContent = "Title and file are required.";
      return;
    }

    const clipId = crypto.randomUUID();
    const storagePath = `${state.user.id}/${clipId}.mp4`;
    const tags = tagsRaw ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean) : [];

    let fakeProgress = 6;
    progress?.classList.add("active");
    if (progressFill) progressFill.style.width = `${fakeProgress}%`;
    const interval = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 8, 92);
      if (progressFill) progressFill.style.width = `${fakeProgress}%`;
    }, 180);

    const { error: uploadError } = await client.storage
      .from("clips")
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    clearInterval(interval);

    if (uploadError) {
      errorEl.textContent = uploadError.message;
      if (progressFill) progressFill.style.width = "0%";
      progress?.classList.remove("active");
      return;
    }

    if (progressFill) progressFill.style.width = "100%";
    setTimeout(() => progress?.classList.remove("active"), 400);

    const { data: publicData } = client.storage.from("clips").getPublicUrl(storagePath);

    const { error: insertError } = await client
      .from("clips")
      .insert({
        id: clipId,
        owner_id: state.user.id,
        title,
        tags,
        storage_path: storagePath,
        public_url: publicData.publicUrl
      });

    if (insertError) {
      errorEl.textContent = insertError.message;
      return;
    }

    showToast("Upload complete");
    form.reset();

    if (preview) {
      preview.innerHTML = "";
      const header = document.createElement("div");
      header.className = "preview-header";
      header.innerHTML = "<p class='subhead'>Upload ready for discovery.</p><a class='btn ghost' href='index.html'>Back to Discover</a>";
      preview.appendChild(header);
      const card = buildClipCard({
        id: clipId,
        owner_id: state.user.id,
        title,
        storage_path: storagePath,
        public_url: publicData.publicUrl
      });
      preview.appendChild(card);
    }
  });
}

// Dashboard page: load user clips and delete
function initDashboard(openModal) {
  if (!state.user) {
    redirectToLogin("dashboard.html");
    return;
  }

  const grid = qs("#dashboard-grid");
  const loadMoreButton = qs("#dashboard-load-more");
  const client = getClient();

  if (!client) {
    renderClips(grid, []);
    showToast("Supabase is not configured.", "error");
    return;
  }

  let allClips = [];
  let pageIndex = 0;
  const pageSize = 12;
  let totalCount = null;
  let loading = false;

  async function loadPage({ reset = false } = {}) {
    if (loading) return;
    loading = true;
    if (reset) {
      pageIndex = 0;
      totalCount = null;
      allClips = [];
    }
    renderSkeletons(grid, 6);

    const from = pageIndex * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await client
      .from("clips")
      .select("*", { count: "exact" })
      .eq("owner_id", state.user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    loading = false;

    if (error) {
      showToast(error.message, "error");
      renderClips(grid, []);
      return;
    }

    totalCount = count;
    const normalized = await normalizeClips(data || []);
    allClips = allClips.concat(normalized);
    renderClips(grid, allClips, { showDelete: true });
    pageIndex += 1;

    if (totalCount !== null && allClips.length >= totalCount) {
      loadMoreButton?.setAttribute("disabled", "disabled");
      loadMoreButton?.classList.add("is-hidden");
    } else {
      loadMoreButton?.removeAttribute("disabled");
      loadMoreButton?.classList.remove("is-hidden");
    }
  }

  loadMoreButton?.addEventListener("click", () => loadPage());

  grid?.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-id]");
    const copyButton = event.target.closest("[data-copy-url]");

    if (copyButton) {
      const url = copyButton.getAttribute("data-copy-url");
      if (url) {
        navigator.clipboard.writeText(url).then(() => {
          showToast("Link copied");
        });
      }
    }

    if (deleteButton) {
      const clipId = deleteButton.getAttribute("data-delete-id");
      const storagePath = deleteButton.getAttribute("data-delete-path");

      openModal?.({
        title: "Delete this clip?",
        body: "This permanently removes the clip and its file.",
        confirmText: "Delete",
        onConfirm: async () => {
          const { error: storageError } = await client.storage
            .from("clips")
            .remove([storagePath]);

          if (storageError) {
            showToast(storageError.message, "error");
            return;
          }

          const { error: deleteError } = await client.from("clips").delete().eq("id", clipId);
          if (deleteError) {
            showToast(deleteError.message, "error");
            return;
          }

          showToast("Clip deleted");
          loadPage({ reset: true });
        }
      });
    }
  });

  loadPage();
}

async function initApp() {
  initCursor();
  initStarfield();
  initReveal();
  initProfileDropdown();
  const openModal = initModal();
  await initAuth();
  guardAuthLinks();

  if (page === "discover") initDiscover();
  if (page === "login") initLogin();
  if (page === "signup") initSignup();
  if (page === "upload") initUpload();
  if (page === "dashboard") initDashboard(openModal);
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
