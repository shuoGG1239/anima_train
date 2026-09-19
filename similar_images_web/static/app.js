const pathInput = document.getElementById("pathInput");
const thresholdInput = document.getElementById("thresholdInput");
const methodInput = document.getElementById("methodInput");
const recursiveInput = document.getElementById("recursiveInput");
const browseBtn = document.getElementById("browseBtn");
const scanBtn = document.getElementById("scanBtn");
const scanStatus = document.getElementById("scanStatus");
const toolbar = document.getElementById("toolbar");
const summaryText = document.getElementById("summaryText");
const selectedText = document.getElementById("selectedText");
const deleteBtn = document.getElementById("deleteBtn");
const groupsRoot = document.getElementById("groupsRoot");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxCaption = document.getElementById("lightboxCaption");
const lightboxClose = document.getElementById("lightboxClose");

let scanId = null;
const selected = new Set();

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function updateSelectionUi() {
  selectedText.textContent = `已选 ${selected.size} 张`;
  deleteBtn.disabled = selected.size === 0;
  document.querySelectorAll(".card").forEach((card) => {
    const path = card.dataset.path;
    card.classList.toggle("selected", selected.has(path));
    const cb = card.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = selected.has(path);
  });
}

function imageUrl(path) {
  const q = new URLSearchParams({ scan_id: scanId, path });
  return `/api/image?${q}`;
}

function openLightbox(path, caption) {
  lightboxImg.src = imageUrl(path);
  lightboxCaption.textContent = caption;
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImg.src = "";
}

function renderGroups(data) {
  groupsRoot.innerHTML = "";
  selected.clear();
  updateSelectionUi();

  if (!data.groups.length) {
    groupsRoot.innerHTML = `<p class="status">未发现相似组（共扫描 ${data.scanned} 张）</p>`;
    toolbar.hidden = true;
    return;
  }

  toolbar.hidden = false;
  const involved = data.groups.reduce((n, g) => n + g.items.length, 0);
  summaryText.textContent = `扫描 ${data.scanned} 张 · ${data.groups.length} 组 · ${involved} 张在组内 · 阈值 ${data.threshold} (${data.method})`;

  for (const group of data.groups) {
    const section = document.createElement("section");
    section.className = "group";

    const head = document.createElement("div");
    head.className = "group-head";
    head.innerHTML = `<span class="group-title">组 ${group.index} · ${group.items.length} 张</span>`;

    const dupBtn = document.createElement("button");
    dupBtn.type = "button";
    dupBtn.className = "btn ghost";
    dupBtn.textContent = "选中除第一张外的重复项";
    dupBtn.addEventListener("click", () => {
      for (let i = 1; i < group.items.length; i++) {
        selected.add(group.items[i].path);
      }
      updateSelectionUi();
    });
    head.appendChild(dupBtn);
    section.appendChild(head);

    const cards = document.createElement("div");
    cards.className = "cards";

    for (const item of group.items) {
      const card = document.createElement("article");
      card.className = "card";
      card.dataset.path = item.path;

      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.addEventListener("change", () => {
        if (cb.checked) selected.add(item.path);
        else selected.delete(item.path);
        updateSelectionUi();
      });

      const thumbWrap = document.createElement("div");
      thumbWrap.className = "thumb-wrap";
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = item.name;
      img.src = imageUrl(item.path);
      img.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLightbox(item.path, item.path);
      });

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<strong>${item.name}</strong>d=${item.distance} · ${formatSize(item.size_bytes)}`;

      thumbWrap.appendChild(img);
      label.appendChild(cb);
      label.appendChild(thumbWrap);
      label.appendChild(meta);
      card.appendChild(label);
      cards.appendChild(card);
    }

    section.appendChild(cards);
    groupsRoot.appendChild(section);
  }
}

async function runScan() {
  const path = pathInput.value.trim();
  if (!path) {
    alert("请输入文件夹路径");
    return;
  }

  scanBtn.disabled = true;
  scanStatus.hidden = false;
  scanStatus.textContent = "扫描中…（大图集可能需要一两分钟）";
  groupsRoot.innerHTML = "";
  toolbar.hidden = true;

  try {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        threshold: Number(thresholdInput.value),
        method: methodInput.value,
        recursive: recursiveInput.checked,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || res.statusText);
    }
    scanId = data.scan_id;
    scanStatus.textContent = `完成 · 根目录 ${data.root}`;
    renderGroups(data);
  } catch (err) {
    scanStatus.textContent = `失败: ${err.message}`;
  } finally {
    scanBtn.disabled = false;
  }
}

async function runDelete() {
  if (!scanId || selected.size === 0) return;
  const paths = [...selected];
  const msg = `确定删除 ${paths.length} 张图片？\n同目录下的同名 .txt 标注也会一并删除。`;
  if (!confirm(msg)) return;

  deleteBtn.disabled = true;
  try {
    const res = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan_id: scanId, paths }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || res.statusText);
    }
    for (const p of paths) {
      selected.delete(p);
      document.querySelectorAll(".card").forEach((card) => {
        if (card.dataset.path === p) card.remove();
      });
    }
    document.querySelectorAll(".group").forEach((group) => {
      if (!group.querySelector(".card")) group.remove();
    });
    updateSelectionUi();
    if (data.errors.length) {
      alert(`部分失败:\n${data.errors.join("\n")}`);
    }
    if (data.deleted.length) {
      scanStatus.textContent = `已删除 ${data.deleted.length} 张`;
    }
  } catch (err) {
    alert(err.message);
  } finally {
    deleteBtn.disabled = selected.size === 0;
  }
}

async function pickFolder() {
  browseBtn.disabled = true;
  const initial = pathInput.value.trim();
  const q = initial ? `?initial=${encodeURIComponent(initial)}` : "";
  try {
    const res = await fetch(`/api/pick-folder${q}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || res.statusText);
    }
    if (data.path) {
      pathInput.value = data.path;
    }
  } catch (err) {
    alert(err.message);
  } finally {
    browseBtn.disabled = false;
  }
}

browseBtn.addEventListener("click", pickFolder);
scanBtn.addEventListener("click", runScan);
deleteBtn.addEventListener("click", runDelete);
lightboxClose.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeLightbox();
});
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});
