/**
 * SafeSpace / Ammar Heritage - ITT588 Lab Work 04
 * Client-Side MVC Controller & Interactive Visualizer: familyApp.js
 * Purpose: Retrieves family JSON, applies dynamic filtering, renders visual hierarchical family tree,
 *          directory with profile editing capability, and demographic statistics.
 * Design: Clean typography initials badges (no cartoon figures), full horizontal scrolling, blood type removed.
 */

"use strict";

const FamilyApp = {
  data: [],
  filtered: [],
  activeTab: "tree",
  treeLineage: "core", // "core", "paternal" (Dad's side), "maternal" (Mom's side)
  zoomLevel: 1.0,
  editingPersonId: null,
  currentAvatarBase64: null,
  activeCohortFilter: null,
  directoryViewMode: "grouped", // "grid", "grouped", "table"
  directorySortBy: "default", // "default", "age-desc", "age-asc", "name-asc", "family"
  autoSaveTimer: null,
  liveMode: false,
  isCreating: false,
  isSaving: false,
  monthsList: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],

  async init() {
    this.detectActiveTab();
    await this.fetchData();
    this.setupDobPickerEvents();
    this.setupTreeSpotlight();
    this.bindEvents();
    this.populateCityFilter();
    this.readUrlFilterParams();
    this.render();
    const params = new URLSearchParams(window.location.search);
    // Deep links: ?add=1 opens the Add popup, ?edit=ID the Edit popup, ?locate=ID spotlights someone in the tree.
    const editId = params.get("edit");
    const locateId = params.get("locate");
    if (params.get("add")) {
      setTimeout(() => this.openCreateModal(), 0);
    } else if (editId) {
      setTimeout(() => this.openEditModal(editId), 0);
    }
    if (locateId && document.getElementById("treeContainer")) {
      setTimeout(() => this.locatePersonInTree(locateId), 300);
    }
  },

  detectActiveTab() {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.replace("#", "").toLowerCase();

    if (path.includes("directory") || hash === "directory" || path.includes("add") || path.includes("edit")) {
      this.activeTab = "directory";
    } else if (path.includes("stats") || hash === "stats") {
      this.activeTab = "stats";
    } else if (path.includes("family") || path.includes("tree") || hash === "tree" || hash === "family") {
      this.activeTab = "tree";
    } else if (document.getElementById("directoryGrid") && !document.getElementById("treeContainer")) {
      this.activeTab = "directory";
    } else if (document.getElementById("statsContainer") && !document.getElementById("treeContainer")) {
      this.activeTab = "stats";
    } else {
      this.activeTab = "tree";
    }

    // Sync tab button active state
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === this.activeTab);
    });
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      pane.style.display = pane.id === `pane-${this.activeTab}` ? "block" : "none";
    });
  },

  async fetchData() {
    try {
      const res = await fetch("/api/people", { headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : payload.people || [];
      this.data = rows.filter((row) => row && row.data).map((row) => ({
        ...row.data,
        id: row.id,
        _updatedAt: row.updated_at,
        _updatedBy: row.updated_by,
      }));
      this.liveMode = true;
      this.filtered = [...this.data];
      this.updateSyncBadge("live");
      return;
    } catch (error) {
      console.error("Cloudflare D1 read failed:", error);
      this.updateSyncBadge("offline");
    }

    const res = await fetch("public/data/people.json");
    const json = await res.json();
    this.data = json.people || [];
    this.filtered = [...this.data];
    this.updateSyncBadge("preview");
  },

  updateSyncBadge(status) {
    const badge = document.getElementById("liveSyncBadge");
    if (!badge) return;
    const states = {
      live: ["Live · synced", "#347b38", "fa-cloud-arrow-up"],
      saving: ["Saving…", "#8b3a3a", "fa-arrows-rotate"],
      offline: ["Offline preview", "#a32929", "fa-cloud-xmark"],
      preview: ["Preview", "#78591f", "fa-cloud"],
    };
    const [text, color, icon] = states[status] || states.offline;
    badge.style.color = color;
    badge.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
  },

  cleanProfileText(value) {
    return String(value ?? "").replace(/[<>"]/g, "").trim();
  },

  cleanPersonForSave(person) {
    const clean = {};
    Object.entries(person).forEach(([key, value]) => {
      if (!key.startsWith("_")) clean[key] = value;
    });
    clean.name = this.cleanProfileText(clean.name);
    clean.spouses = Array.isArray(clean.spouses) ? clean.spouses : [];
    clean.children = Array.isArray(clean.children) ? clean.children : [];
    return clean;
  },

  getPerson(id) {
    return this.data.find((p) => p.id === id) || null;
  },

  bindEvents() {
    const addPersonBtn = document.getElementById("btnAddPerson");
    if (addPersonBtn) addPersonBtn.addEventListener("click", () => {
      this.openCreateModal();
    });
    const deletePersonBtn = document.getElementById("btnDeletePerson");
    if (deletePersonBtn) deletePersonBtn.addEventListener("click", () => this.deletePerson());

    // Search input
    const searchInputs = document.querySelectorAll("#searchFamily");
    searchInputs.forEach((input) => {
      input.addEventListener("input", (e) => this.applyFilters(e.target.value));
    });

    // Filter selectors & Sort
    const branchFilters = document.querySelectorAll("#filterBranch");
    const familyUnitFilters = document.querySelectorAll("#filterFamilyUnit");
    const genFilters = document.querySelectorAll("#filterGen");
    const genderFilters = document.querySelectorAll("#filterGender");
    const cityFilters = document.querySelectorAll("#filterCity");
    const sortSelectors = document.querySelectorAll("#sortDirectoryBy");

    [...branchFilters, ...familyUnitFilters, ...genFilters, ...genderFilters, ...cityFilters, ...sortSelectors].forEach((sel) => {
      sel.addEventListener("change", () => this.applyFilters());
    });

    // View mode switchers (Cards, By Family, Table)
    document.querySelectorAll(".view-mode-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const mode = e.currentTarget.dataset.viewMode;
        if (!mode) return;
        this.directoryViewMode = mode;
        document.querySelectorAll(".view-mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.viewMode === mode));
        this.renderDirectory();
      });
    });

    // Export JSON buttons (for GitHub Pages deployment & backup)
    document.querySelectorAll("#btnExportJson").forEach((btn) => {
      btn.addEventListener("click", () => this.exportUpdatedJson());
    });

    // Avatar upload and remove
    const avatarInput = document.getElementById("editAvatarInput");
    if (avatarInput) {
      avatarInput.addEventListener("change", (e) => this.handleAvatarUpload(e));
    }
    const removeAvatarBtn = document.getElementById("btnRemoveAvatar");
    if (removeAvatarBtn) {
      removeAvatarBtn.addEventListener("click", () => this.handleRemoveAvatar());
    }

    // Reset filters
    document.querySelectorAll("#resetFilters").forEach((btn) => {
      btn.addEventListener("click", () => this.resetFilters());
    });

    // Tab navigation
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
        const pathMap = { tree: "/family", directory: "/directory", stats: "/stats" };
        if (pathMap[tab]) {
          window.history.pushState({ tab }, "", pathMap[tab]);
        }
      });
    });

    window.addEventListener("popstate", () => {
      this.detectActiveTab();
      this.render();
    });

    // Lineage switcher buttons
    document.querySelectorAll(".lineage-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".lineage-btn").forEach((b) => b.classList.remove("active"));
        e.currentTarget.classList.add("active");
        this.treeLineage = e.currentTarget.dataset.lineage;
        this.renderTree();
      });
    });

    // Tree Global Actions: Expand All / Collapse All
    const expandAllBtn = document.getElementById("btnExpandAll");
    const collapseAllBtn = document.getElementById("btnCollapseAll");
    if (expandAllBtn) {
      expandAllBtn.addEventListener("click", () => {
        document.querySelectorAll(".tree-children-wrapper").forEach((el) => {
          el.classList.remove("collapsed");
        });
        document.querySelectorAll(".tree-toggle-pill").forEach((btn) => {
          btn.classList.remove("collapsed");
          btn.innerHTML = `<i class="fa-solid fa-minus"></i> ${btn.dataset.count} Children`;
        });
      });
    }
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener("click", () => {
        document.querySelectorAll(".tree-children-wrapper").forEach((el) => {
          el.classList.add("collapsed");
        });
        document.querySelectorAll(".tree-toggle-pill").forEach((btn) => {
          btn.classList.add("collapsed");
          btn.innerHTML = `<i class="fa-solid fa-plus"></i> ${btn.dataset.count} Children`;
        });
      });
    }

    // Zoom Controls
    const zoomInBtn = document.getElementById("btnZoomIn");
    const zoomOutBtn = document.getElementById("btnZoomOut");
    const zoomResetBtn = document.getElementById("btnZoomReset");
    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => {
        this.zoomLevel = Math.min(1.4, this.zoomLevel + 0.1);
        this.applyZoom();
      });
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => {
        this.zoomLevel = Math.max(0.65, this.zoomLevel - 0.1);
        this.applyZoom();
      });
    }
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener("click", () => {
        this.zoomLevel = 1.0;
        this.applyZoom();
      });
    }

    // Modal Close
    const closeBtn = document.getElementById("closeModal");
    const modal = document.getElementById("personModal");
    if (closeBtn) closeBtn.addEventListener("click", () => this.closeModal());
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closeModal();
      });
    }

    // Edit Modal Close & Real-Time Auto-Save Bindings
    const closeEditBtn = document.getElementById("closeEditModal");
    const editModal = document.getElementById("editPersonModal");
    const editForm = document.getElementById("editPersonForm");

    if (closeEditBtn) closeEditBtn.addEventListener("click", () => this.closeEditModal());
    if (editModal) {
      editModal.addEventListener("click", (e) => {
        if (e.target === editModal) this.closeEditModal();
      });
    }

    if (editForm) {
      editForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveProfile();
      });

      // Auto-save existing profiles one second after typing.
      editForm.querySelectorAll("input:not([type='file']), textarea, select").forEach((input) => {
        input.addEventListener("input", () => this.triggerAutoSave(false));
        input.addEventListener("change", () => this.triggerAutoSave(true));
      });
    }

    // Gender segmented pill control buttons
    const maleBtn = document.getElementById("btnGenderMale");
    const femaleBtn = document.getElementById("btnGenderFemale");
    const hiddenGender = document.getElementById("editGender");

    if (maleBtn) {
      maleBtn.addEventListener("click", () => {
        if (hiddenGender) hiddenGender.value = "male";
        maleBtn.classList.add("active");
        if (femaleBtn) femaleBtn.classList.remove("active");
        this.triggerAutoSave(true);
      });
    }
    if (femaleBtn) {
      femaleBtn.addEventListener("click", () => {
        if (hiddenGender) hiddenGender.value = "female";
        femaleBtn.classList.add("active");
        if (maleBtn) maleBtn.classList.remove("active");
        this.triggerAutoSave(true);
      });
    }

    // Every family member can upload a photo.
    const triggerPhotoBtn = document.getElementById("btnTriggerPhoto");
    if (triggerPhotoBtn) {
      triggerPhotoBtn.addEventListener("click", () => {
        const fileInput = document.getElementById("editAvatarInput");
        if (fileInput) fileInput.click();
      });
    }

    const doneBtn = document.getElementById("btnDoneEdit");
    if (doneBtn) doneBtn.addEventListener("click", () => this.saveProfile());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeModal();
        this.closeEditModal();
      }
    });
  },

  applyZoom() {
    const tree = document.getElementById("familyTreeRoot");
    const zoomLabel = document.getElementById("zoomLabel");
    if (tree) {
      tree.style.transform = `scale(${this.zoomLevel})`;
      tree.style.transformOrigin = "top center";
    }
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
  },

  /* ==========================================================================
     FLOATING TOAST NOTIFICATION SYSTEM (AUTO-DISMISSES IN 2 SECONDS)
     ========================================================================== */
  showToast(title, desc, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const icons = {
      success: "fa-circle-check",
      info: "fa-cloud-arrow-down",
      warn: "fa-triangle-exclamation",
    };
    const iconClass = icons[type] || "fa-bell";

    const toast = document.createElement("div");
    toast.className = "toast-item";
    toast.innerHTML = `
      <div class="toast-icon ${type}">
        <i class="fa-solid ${iconClass}"></i>
      </div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-desc">${desc}</div>
      </div>
      <div class="toast-progress"></div>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    // Auto-dismiss after 2 seconds
    setTimeout(() => {
      toast.classList.remove("show");
      toast.classList.add("hide");
      setTimeout(() => toast.remove(), 260);
    }, 2000);
  },

  /* ==========================================================================
     FAST DATE OF BIRTH PICKER & INSTANT AGE CALCULATION
     ========================================================================== */
  setupDobPickerEvents() {
    const datePicker = document.getElementById("editDobPicker");
    if (!datePicker) return;

    const onDateChange = (rawDate) => {
      if (!rawDate) return;
      const parts = rawDate.split("-");
      if (parts.length !== 3) return;

      const year = parseInt(parts[0], 10);
      const mIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const monthStr = this.monthsList[mIdx] || "JAN";

      const formattedDob = `${String(day).padStart(2, "0")}-${monthStr}-${year}`;
      const hiddenDob = document.getElementById("editDob");
      const badge = document.getElementById("dobFormattedBadge");

      if (hiddenDob) hiddenDob.value = formattedDob;
      if (badge) badge.textContent = formattedDob;

      // Fast Auto-calculate Age
      const today = new Date();
      let age = today.getFullYear() - year;
      const mDiff = today.getMonth() - mIdx;
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < day)) {
        age--;
      }
      if (age < 0) age = 0;

      const ageInput = document.getElementById("editAge");
      const ageDisplay = document.getElementById("ageAutoDisplay");
      if (ageInput) ageInput.value = age;
      if (ageDisplay) {
        ageDisplay.innerHTML = `Age <b>${age}</b>y`;
      }

      this.triggerAutoSave(true);
    };

    datePicker.addEventListener("input", (e) => onDateChange(e.target.value));
    datePicker.addEventListener("change", (e) => onDateChange(e.target.value));
  },

  /* ==========================================================================
     TREE SPOTLIGHT / RELATIVE FINDER
     ========================================================================== */
  setupTreeSpotlight() {
    const treeSearchInputs = document.querySelectorAll("#treeSearchInput");
    treeSearchInputs.forEach((input) => {
      input.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase().trim();
        document.querySelectorAll(".tree-member").forEach((el) => {
          el.classList.remove("spotlight");
        });
        if (!term) return;

        const matchedPerson = this.data.find(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            (p.nickname && p.nickname.toLowerCase().includes(term))
        );

        if (matchedPerson) {
          const node = document.querySelector(`.tree-member[data-id="${matchedPerson.id}"]`);
          if (node) {
            // Auto expand any collapsed parent branches
            let cur = node.parentElement;
            while (cur && cur !== document.body) {
              if (cur.classList.contains("tree-children-wrapper") && cur.classList.contains("collapsed")) {
                cur.classList.remove("collapsed");
                const pill = cur.previousElementSibling?.querySelector(".tree-toggle-pill");
                if (pill) {
                  pill.classList.remove("collapsed");
                  pill.innerHTML = `<i class="fa-solid fa-minus"></i> ${pill.dataset.count} Children`;
                }
              }
              cur = cur.parentElement;
            }

            node.classList.add("spotlight");
            node.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          }
        }
      });
    });
  },

  /* ==========================================================================
     AVATAR / PICTURE UPLOAD (IMMEDIATE FAMILY EXCLUSIVE)
     ========================================================================== */
  handleAvatarUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      this.showToast("Unsupported Image", "Choose a JPG, PNG, or WebP photo. iPhone HEIC photos may need to be switched to Most Compatible.", "warn");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      this.showToast("Photo Not Read", "This photo could not be read. Try a JPG or switch the camera to Most Compatible.", "warn");
    };
    reader.onload = (event) => {
      const image = new Image();
      image.onerror = () => {
        this.showToast("Photo Not Read", "This photo could not be read. Try a JPG or switch the camera to Most Compatible.", "warn");
      };
      image.onload = () => {
        const size = 480;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const sourceSize = Math.min(image.width, image.height);
        const sx = Math.round((image.width - sourceSize) / 2);
        const sy = Math.round((image.height - sourceSize) / 2);
        ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
        this.currentAvatarBase64 = canvas.toDataURL("image/jpeg", 0.82);

        const avatarPreview = document.getElementById("editAvatarPreview");
        const avatarInitials = document.getElementById("editAvatarInitials");
        const removeBtn = document.getElementById("btnRemoveAvatar");
        if (avatarPreview) {
          avatarPreview.src = this.currentAvatarBase64;
          avatarPreview.style.display = "block";
        }
        if (avatarInitials) avatarInitials.style.display = "none";
        if (removeBtn) removeBtn.style.display = "inline-block";
        setTimeout(() => this.triggerAutoSave(true), 100);
        this.showToast("Photo Ready", "Photo cropped and saved for this profile.", "success");
      };
      image.src = event.target.result;
    };
    reader.readAsDataURL(file);
  },

  handleRemoveAvatar() {
    this.currentAvatarBase64 = null;
    const avatarPreview = document.getElementById("editAvatarPreview");
    const avatarInitials = document.getElementById("editAvatarInitials");
    const removeBtn = document.getElementById("btnRemoveAvatar");
    const fileInput = document.getElementById("editAvatarInput");

    if (avatarPreview) avatarPreview.style.display = "none";
    if (avatarInitials) avatarInitials.style.display = "block";
    if (removeBtn) removeBtn.style.display = "none";
    if (fileInput) fileInput.value = "";

    setTimeout(() => this.triggerAutoSave(true), 100);
    this.showToast("Photo Ready", "Select Save Profile to remove this photo.", "info");
  },

  /* ==========================================================================
     EXPORT UPDATED JSON (DEPLOYMENT ON GITHUB.IO & OFFLINE PERSISTENCE)
     ========================================================================== */
  exportUpdatedJson() {
    const exportDataset = {
      title: "Ammar Syaathir Family Heritage Tree (Updated)",
      meta: {
        course: "ITT588 - Front-End Technology (Lab Work 4)",
        student: "Muhammad Ammar Syaathir Bin Abd Rahim",
        studentId: "2025179251",
        group: "CS2666B",
        exportedAt: new Date().toISOString(),
        totalMembers: this.data.length,
      },
      people: this.data,
    };

    const jsonString = JSON.stringify(exportDataset, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = "people.json";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    this.showToast(
      "Dataset Exported",
      "people.json downloaded! Commit & push to deploy on GitHub Pages.",
      "info"
    );
  },

  populateCityFilter() {
    const cityFilters = document.querySelectorAll("#filterCity");
    if (!cityFilters.length) return;
    const cities = ["Rembau", "Seremban", "Bandar Saujana Putra", "Kuala Lumpur", "Kajang", "Putrajaya", "Shah Alam"];
    cityFilters.forEach((sel) => {
      while (sel.options.length > 1) sel.remove(1);
      cities.forEach((city) => {
        const opt = document.createElement("option");
        opt.value = city;
        opt.textContent = city;
        sel.appendChild(opt);
      });
    });
  },

  applyFilters() {
    const search = (document.getElementById("searchFamily")?.value || "").toLowerCase().trim();
    const branch = document.getElementById("filterBranch")?.value || "all";
    const familyUnit = document.getElementById("filterFamilyUnit")?.value || "all";
    const gen = document.getElementById("filterGen")?.value || "all";
    const gender = document.getElementById("filterGender")?.value || "all";
    const city = document.getElementById("filterCity")?.value || "all";

    this.filtered = this.data.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search) ||
        (p.nickname && p.nickname.toLowerCase().includes(search)) ||
        (p.city && p.city.toLowerCase().includes(search)) ||
        (p.profession && p.profession.toLowerCase().includes(search));

      const matchBranch =
        branch === "all" ||
        p.branch === branch ||
        (branch === "immediate" && p.branch === "immediate");

      const matchFamilyUnit = familyUnit === "all" || p.familyUnit === familyUnit;
      const matchGen = gen === "all" || String(p.generation) === String(gen);
      const matchGender = gender === "all" || p.gender === gender;
      const matchCity = city === "all" || (p.city && p.city.toLowerCase().includes(city.toLowerCase()));

      const matchCohort =
        !this.activeCohortFilter ||
        (this.activeCohortFilter === "elders"
          ? p.age >= 60
          : this.activeCohortFilter === "adults"
          ? p.age >= 35 && p.age < 60
          : this.activeCohortFilter === "youth"
          ? p.age >= 18 && p.age < 35
          : this.activeCohortFilter === "kids"
          ? p.age < 18
          : true);

      return matchSearch && matchBranch && matchFamilyUnit && matchGen && matchGender && matchCity && matchCohort;
    });

    // Advanced Sorting
    const sortVal = document.getElementById("sortDirectoryBy")?.value || this.directorySortBy || "default";
    this.directorySortBy = sortVal;

    if (sortVal === "age-desc") {
      this.filtered.sort((a, b) => (b.age || 0) - (a.age || 0));
    } else if (sortVal === "age-asc") {
      this.filtered.sort((a, b) => (a.age || 0) - (b.age || 0));
    } else if (sortVal === "name-asc") {
      this.filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortVal === "family") {
      this.filtered.sort((a, b) => (a.familyUnit || "").localeCompare(b.familyUnit || ""));
    } else {
      // Default: Generation (1 to 4), then Age descending
      this.filtered.sort((a, b) => {
        if (a.generation !== b.generation) return a.generation - b.generation;
        return (b.age || 0) - (a.age || 0);
      });
    }

    this.render();
  },

  resetFilters() {
    this.activeCohortFilter = null;
    this.directorySortBy = "default";
    document.querySelectorAll("#searchFamily").forEach((i) => (i.value = ""));
    document.querySelectorAll("#filterBranch").forEach((s) => (s.value = "all"));
    document.querySelectorAll("#filterFamilyUnit").forEach((s) => (s.value = "all"));
    document.querySelectorAll("#filterGen").forEach((s) => (s.value = "all"));
    document.querySelectorAll("#filterGender").forEach((s) => (s.value = "all"));
    document.querySelectorAll("#filterCity").forEach((s) => (s.value = "all"));
    document.querySelectorAll("#sortDirectoryBy").forEach((s) => (s.value = "default"));

    this.filtered = [...this.data];
    this.filtered.sort((a, b) => {
      if (a.generation !== b.generation) return a.generation - b.generation;
      return (b.age || 0) - (a.age || 0);
    });
    this.render();
  },

  /* ==========================================================================
     CROSS-PAGE & TAB DIRECTORY FILTERING (URL SYNC + SINGLE-PAGE TAB SWITCH)
     ========================================================================== */
  readUrlFilterParams() {
    const params = new URLSearchParams(window.location.search);
    const branch = params.get("branch");
    const gen = params.get("gen");
    const familyUnit = params.get("familyUnit");
    const search = params.get("search");
    const cohort = params.get("cohort");
    const city = params.get("city");

    let hasFilter = false;

    if (branch) {
      document.querySelectorAll("#filterBranch").forEach((sel) => (sel.value = branch));
      hasFilter = true;
    }
    if (gen) {
      document.querySelectorAll("#filterGen").forEach((sel) => (sel.value = gen));
      hasFilter = true;
    }
    if (familyUnit) {
      document.querySelectorAll("#filterFamilyUnit").forEach((sel) => (sel.value = familyUnit));
      hasFilter = true;
    }
    if (search) {
      document.querySelectorAll("#searchFamily").forEach((input) => (input.value = search));
      hasFilter = true;
    }
    if (cohort) {
      this.activeCohortFilter = cohort;
      hasFilter = true;
    }
    if (city) {
      document.querySelectorAll("#filterCity").forEach((sel) => (sel.value = city));
      hasFilter = true;
    }

    if (hasFilter) {
      this.applyFilters();
      const label = familyUnit
        ? (this.data.find((p) => p.familyUnit === familyUnit)?.familyLabel || familyUnit)
        : branch
        ? `${branch.toUpperCase()} Lineage`
        : gen
        ? `Generation ${gen}`
        : cohort
        ? `${cohort.toUpperCase()} Cohort`
        : city
        ? `${city} Residents`
        : search;

      setTimeout(() => {
        this.showToast("Filter Applied", `Viewing ${label} in Directory`, "info");
      }, 400);
    }
  },

  filterAndNavigateToDirectory({ branch, gen, familyUnit, search, cohort, city }) {
    const hasDirectoryOnPage = !!document.getElementById("directoryGrid");
    const isStatsUrl = window.location.pathname.toLowerCase().includes("stats");

    if (hasDirectoryOnPage && !isStatsUrl) {
      // In single-page mode (e.g. index.html): switch tab and apply filter immediately
      if (branch) {
        document.querySelectorAll("#filterBranch").forEach((sel) => (sel.value = branch));
      }
      if (gen) {
        document.querySelectorAll("#filterGen").forEach((sel) => (sel.value = String(gen)));
      }
      if (familyUnit) {
        document.querySelectorAll("#filterFamilyUnit").forEach((sel) => (sel.value = familyUnit));
      }
      if (search) {
        document.querySelectorAll("#searchFamily").forEach((input) => (input.value = search));
      }
      if (cohort) {
        this.activeCohortFilter = cohort;
      }
      if (city) {
        document.querySelectorAll("#filterCity").forEach((sel) => (sel.value = city));
      }

      this.switchTab("directory");
      this.applyFilters();

      const target = document.getElementById("pane-directory") || document.getElementById("directoryGrid");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      const label = familyUnit
        ? (this.data.find((p) => p.familyUnit === familyUnit)?.familyLabel || familyUnit)
        : branch
        ? `${branch.toUpperCase()} Lineage`
        : gen
        ? `Generation ${gen}`
        : cohort
        ? `${cohort.toUpperCase()} Cohort`
        : city
        ? `${city} Residents`
        : search || "Selected";

      this.showToast("Filter Applied", `Viewing ${label} in Directory`, "info");
    } else {
      // Multi-page Express server mode (/stats): Navigate to /directory with query parameters
      const params = new URLSearchParams();
      if (branch) params.set("branch", branch);
      if (gen) params.set("gen", String(gen));
      if (familyUnit) params.set("familyUnit", familyUnit);
      if (search) params.set("search", search);
      if (cohort) params.set("cohort", cohort);
      if (city) params.set("city", city);

      window.location.href = `directory.html?${params.toString()}`;
    }
  },

  switchTab(tab) {
    this.activeTab = tab;

    // In single-page mode or tab mode, update views
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      pane.style.display = pane.id === `pane-${tab}` ? "block" : "none";
    });

    this.render();
  },

  render() {
    this.updateStatsCounters();

    // Check DOM elements present to guarantee rendering even on direct page routes
    if (document.getElementById("treeContainer") && (this.activeTab === "tree" || !document.getElementById("directoryGrid"))) {
      this.renderTree();
    }
    if (document.getElementById("directoryGrid")) {
      this.renderDirectory();
    }
    if (document.getElementById("statsContainer")) {
      this.renderStatsView();
    }
  },

  updateStatsCounters() {
    const countEl = document.getElementById("filteredCount");
    if (countEl) countEl.textContent = this.filtered.length;
    const totalEl = document.getElementById("totalCount");
    if (totalEl) totalEl.textContent = this.data.length;
  },

  /* ==========================================================================
     CLEAN INITIALS AVATAR BADGE (NO CARTOON FACES)
     ========================================================================== */
  getCleanInitials(person) {
    const raw = person.nickname || person.name || "M";
    const words = raw.trim().split(" ");
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  },

  getAvatarHtml(p, cssClass = "avatar-img") {
    if (!p) return "";
    if (p.avatar) {
      return `<img src="${p.avatar}" alt="${p.name || ""}" class="${cssClass}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;" />`;
    }
    return `<span>${this.getCleanInitials(p)}</span>`;
  },

  getSpouses(person) {
    if (!person) return [];
    const spouseList = [];
    const directIds = (person.spouses || []).map((s) => (typeof s === "string" ? s : s?.id)).filter(Boolean);
    directIds.forEach((sid) => {
      const p = this.getPerson(sid);
      if (p && !spouseList.some((x) => x.id === p.id)) spouseList.push(p);
    });
    // Find any member who has person.id in their spouses list
    (this.data || []).forEach((other) => {
      if (other.id === person.id) return;
      const otherSpouses = (other.spouses || []).map((s) => (typeof s === "string" ? s : s?.id)).filter(Boolean);
      if (otherSpouses.includes(person.id) && !spouseList.some((x) => x.id === other.id)) {
        spouseList.push(other);
      }
    });
    return spouseList;
  },

  getChildren(person, spouse = null) {
    if (!person) return [];
    const kids = [];
    const directIds = [
      ...(person.children || []),
      ...(spouse ? (spouse.children || []) : [])
    ];
    directIds.forEach((cid) => {
      const c = this.getPerson(cid);
      if (c && !kids.some((x) => x.id === c.id)) kids.push(c);
    });
    // Find any member whose fatherId or motherId matches person or spouse
    (this.data || []).forEach((other) => {
      if (other.id === person.id || (spouse && other.id === spouse.id)) return;
      const isChild =
        other.fatherId === person.id ||
        other.motherId === person.id ||
        (spouse && (other.fatherId === spouse.id || other.motherId === spouse.id));
      if (isChild && !kids.some((x) => x.id === other.id)) {
        kids.push(other);
      }
    });
    return kids.sort((a, b) => (a.generation || 0) - (b.generation || 0) || (b.age || 0) - (a.age || 0));
  },

  renderTreeMemberNode(person, customRole) {
    if (!person) return "";
    const isMe = person.id === "c_ammar";
    const initials = this.getCleanInitials(person);

    return `
      <div class="tree-member ${isMe ? "is-me" : ""}" data-id="${person.id}">
        <div class="tree-avatar-circle ${person.gender}">
          ${person.avatar ? `<img src="${person.avatar}" alt="${person.name}" class="avatar-photo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />` : initials}
          ${isMe ? `<span class="me-star-badge"><i class="fa-solid fa-crown"></i> ME</span>` : ""}
        </div>
        <div class="tree-member-name" title="${person.name}">${person.name}</div>
        <div class="tree-member-meta">${typeof person.age === "number" ? `${person.age} yrs` : "Age unknown"}</div>
      </div>
    `;
  },

  renderTreePersonOrCouple(person, defaultRole) {
    if (!person) return "";
    const spouses = this.getSpouses(person);
    const right = spouses[0] || null;
    const kids = this.getChildren(person, right);

    if (!right && !kids.length) {
      return this.renderTreeMemberNode(person, defaultRole);
    }

    const rightLabel = right ? (right.familyLabel || (right.gender === "female" ? "WIFE" : "HUSBAND")) : "";
    const targetId = `branch-sub-${person.id}`;

    return `
      <div class="tree-couple-box">
        ${this.renderTreeMemberNode(person, defaultRole)}
        ${right ? `<div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>${this.renderTreeMemberNode(right, rightLabel)}` : ""}
      </div>
      ${kids.length ? `
        <div class="tree-branch-connector">
          <div class="tree-stem-down"></div>
          <button class="tree-toggle-pill" data-target="${targetId}" data-count="${kids.length}">
            <i class="fa-solid fa-minus"></i> ${kids.length} ${kids.length === 1 ? "Child" : "Children"}
          </button>
        </div>
        <div class="tree-children-wrapper" id="${targetId}">
          ${kids.map((c) => `<div class="tree-child-column">${this.renderTreePersonOrCouple(c, "CHILD")}</div>`).join("")}
        </div>
      ` : ""}
    `;
  },

  /* ==========================================================================
     HIERARCHICAL VISUAL TREE BUILDER (MATCHES A+B -> CHILDREN REFERENCE)
     ========================================================================== */
  renderTree() {
    const container = document.getElementById("treeContainer");
    if (!container) return;

    let html = `<div class="genealogy-tree" id="familyTreeRoot">`;

    if (this.treeLineage === "paternal") {
      html += this.buildPaternalLineageTree();
    } else if (this.treeLineage === "maternal") {
      html += this.buildMaternalLineageTree();
    } else {
      html += this.buildCoreFamilyTree();
    }

    html += `</div>`;
    container.innerHTML = html;

    this.attachTreeInteractions(container);
    this.applyZoom();

    // Wide trees open centred on the top couple instead of at the far left.
    const viewport = container.closest(".tree-viewport");
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      });
    }
  },

  buildPaternalLineageTree() {
    const isa = this.getPerson("p_isa");
    const zaharah = this.getPerson("p_zaharah");

    const paklong = this.getPerson("d_paklong");
    const maklong = this.getPerson("d_paklong_w");
    const pl_kids = ["d_pl_c1", "d_pl_c2", "d_pl_c3", "d_pl_c4"].map((id) => this.getPerson(id)).filter(Boolean);

    const pakngah = this.getPerson("d_pakngah");
    const makngah = this.getPerson("d_pakngah_w");
    const pn_kids = ["d_pn_c1", "d_pn_c2", "d_pn_c3", "d_pn_c4"].map((id) => this.getPerson(id)).filter(Boolean);

    const dad = this.getPerson("d_dad");
    const mom = this.getPerson("m_shafrah");

    const asyraf = this.getPerson("c_asyraf");
    const esyha = this.getPerson("c_esyha");
    const nieces = ["g4_aisy", "g4_ayesha"].map((id) => this.getPerson(id)).filter(Boolean);

    const makteh = this.getPerson("d_makteh");
    const mt_kids = ["d_mt_ika", "d_mt_miza", "d_mt_ain", "d_mt_mirul"].map((id) => this.getPerson(id)).filter(Boolean);

    const aciknora = this.getPerson("d_aciknora");
    const izzan = this.getPerson("d_izzan");

    const maksulaili = this.getPerson("d_maksulaili");
    const azman = this.getPerson("d_azman");
    const ms_kids = ["d_ms_c1", "d_ms_c2", "d_ms_c3", "d_ms_c4", "d_ms_c5", "d_ms_c6", "d_ms_c7"].map((id) => this.getPerson(id)).filter(Boolean);

    return `
      <!-- ROOT: GRANDPARENTS (A + B) -->
      <div class="tree-branch">
        <div class="tree-couple-box">
          ${this.renderTreeMemberNode(isa, "GRANDFATHER")}
          <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
          ${this.renderTreeMemberNode(zaharah, "GRANDMOTHER")}
        </div>

        <div class="tree-branch-connector">
          <div class="tree-stem-down"></div>
          <button class="tree-toggle-pill" data-target="branch-gen2-dad" data-count="6">
            <i class="fa-solid fa-minus"></i> 6 Children Branches
          </button>
        </div>

        <!-- GENERATION 2 SIBLINGS ROW -->
        <div class="tree-children-wrapper" id="branch-gen2-dad">
          
          <!-- Unit 1: Paklong + Maklong -->
          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(paklong, "UNCLE (PAKLONG)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(maklong, "AUNT (MAKLONG)")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill" data-target="branch-pl" data-count="4">
                <i class="fa-solid fa-minus"></i> 4 Children
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-pl">
              ${pl_kids
                .map(
                  (c, i) => `
                <div class="tree-child-column">
                  ${this.renderTreePersonOrCouple(c, `COUSIN ${i + 1}`)}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <!-- Unit 2: Pakngah + Makngah -->
          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(pakngah, "UNCLE (PAKNGAH)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(makngah, "AUNT (MAKNGAH)")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill" data-target="branch-pn" data-count="4">
                <i class="fa-solid fa-minus"></i> 4 Children
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-pn">
              ${pn_kids
                .map(
                  (c, i) => `
                <div class="tree-child-column">
                  ${this.renderTreePersonOrCouple(c, `COUSIN ${i + 5}`)}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <!-- Unit 3: Dad + Mom [CORE IMMEDIATE FAMILY] -->
          <div class="tree-child-column">
            <div class="tree-couple-box" style="padding: 10px; background: #fffdf7; border: 2px dashed #f59e0b; border-radius: 20px;">
              ${this.renderTreeMemberNode(dad, "FATHER (DAD)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(mom, "MOTHER (MOM)")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill active-core" data-target="branch-core" data-count="5">
                <i class="fa-solid fa-minus"></i> 5 Siblings (Core)
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-core">
              
              <!-- Brother Asyraf + Esyha (With Gen 4 Nieces!) -->
              <div class="tree-child-column">
                <div class="tree-couple-box">
                  ${this.renderTreeMemberNode(asyraf, "BROTHER (ASYRAF)")}
                  <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
                  ${this.renderTreeMemberNode(esyha, "SISTER-IN-LAW")}
                </div>
                <div class="tree-branch-connector">
                  <div class="tree-stem-down"></div>
                  <button class="tree-toggle-pill" data-target="branch-nieces" data-count="2">
                    <i class="fa-solid fa-minus"></i> 2 Nieces (Gen 4)
                  </button>
                </div>
                <div class="tree-children-wrapper" id="branch-nieces">
                  ${nieces
                    .map(
                      (nc) => `
                    <div class="tree-child-column">
                      ${this.renderTreeMemberNode(nc, `NIECE (${nc.age} YRS)`)}
                    </div>
                  `
                    )
                    .join("")}
                </div>
              </div>

              <!-- Sister Aliah -->
              <div class="tree-child-column">
                ${this.renderTreePersonOrCouple(this.getPerson("c_aliah"), "SISTER (ALIAH)")}
              </div>

              <!-- Sister Aqilah -->
              <div class="tree-child-column">
                ${this.renderTreePersonOrCouple(this.getPerson("c_aqilah"), "SISTER (AQILAH)")}
              </div>

              <!-- Sister Adilah -->
              <div class="tree-child-column">
                ${this.renderTreePersonOrCouple(this.getPerson("c_adilah"), "SISTER (ADILAH)")}
              </div>

              <!-- ME: Ammar Syaathir -->
              <div class="tree-child-column">
                ${this.renderTreePersonOrCouple(this.getPerson("c_ammar"), "ME (AMMAR)")}
              </div>

            </div>
          </div>

          <!-- Unit 4: Makteh -->
          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(makteh, "AUNT (MAKTEH)")}
              ${this.getSpouses(makteh)[0] ? `<div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>${this.renderTreeMemberNode(this.getSpouses(makteh)[0], "UNCLE")}` : ""}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill" data-target="branch-mt" data-count="${mt_kids.length}">
                <i class="fa-solid fa-minus"></i> ${mt_kids.length} Children
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-mt">
              ${mt_kids
                .map(
                  (c) => `
                <div class="tree-child-column">
                  ${this.renderTreePersonOrCouple(c, `COUSIN (${c.nickname || "Cousin"})`)}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <!-- Unit 5: Acik Nora + Izzan -->
          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(aciknora, "AUNT (ACIK NORA)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(izzan, "UNCLE (IZZAN)")}
            </div>
          </div>

          <!-- Unit 6: Maksu Laili + Azman -->
          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(maksulaili, "AUNT (MAKSU LAILI)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(azman, "UNCLE (AZMAN)")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill" data-target="branch-ms" data-count="7">
                <i class="fa-solid fa-minus"></i> 7 Children
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-ms">
              ${ms_kids
                .map(
                  (c, i) => `
                <div class="tree-child-column">
                  ${this.renderTreePersonOrCouple(c, `COUSIN ${i + 1}`)}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

        </div>
      </div>
    `;
  },

  buildMaternalLineageTree(includeCore = true) {
    const zain = this.getPerson("m_zain");
    const noraini = this.getPerson("m_noraini");

    const zainal = this.getPerson("m_zainal");
    const nolina = this.getPerson("m_nolina");
    const zn_kids = ["m_zn_amelia", "m_zn_alysaa", "m_zn_alany", "m_zn_hilman"].map((id) => this.getPerson(id)).filter(Boolean);

    const azhar = this.getPerson("m_azhar");
    const norita = this.getPerson("m_norita");
    const az_kids = ["m_az_hairie", "m_az_syalina"].map((id) => this.getPerson(id)).filter(Boolean);

    const mom = this.getPerson("m_shafrah");
    const dad = this.getPerson("d_dad");

    const mazri = this.getPerson("m_mazri");
    const nordin = this.getPerson("m_mazri_s");
    const mz_kids = ["m_mz_izzat", "m_mz_izzudin", "m_mz_aiman", "m_mz_airin", "m_mz_aisyah"].map((id) => this.getPerson(id)).filter(Boolean);

    const yusma = this.getPerson("m_yusma");
    const hamzah = this.getPerson("m_hamzah");
    const ym_kids = ["m_ym_hafizah", "m_ym_hidayah", "m_ym_izzah"].map((id) => this.getPerson(id)).filter(Boolean);

    const asyraf = this.getPerson("c_asyraf");
    const esyha = this.getPerson("c_esyha");
    const nieces = ["g4_aisy", "g4_ayesha"].map((id) => this.getPerson(id)).filter(Boolean);

    return `
      <div class="tree-branch">
        <div class="tree-couple-box">
          ${this.renderTreeMemberNode(zain, "GRANDFATHER")}
          <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
          ${this.renderTreeMemberNode(noraini, "GRANDMOTHER")}
        </div>

        <div class="tree-branch-connector">
          <div class="tree-stem-down"></div>
          <button class="tree-toggle-pill" data-target="branch-gen2-mom" data-count="5">
            <i class="fa-solid fa-minus"></i> 5 Children Branches
          </button>
        </div>

        <div class="tree-children-wrapper" id="branch-gen2-mom">
          
          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(zainal, "UNCLE (ZAINAL)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(nolina, "AUNT (NOLINA)")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill" data-target="branch-zn" data-count="4">
                <i class="fa-solid fa-minus"></i> 4 Children
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-zn">
              ${zn_kids
                .map(
                  (c) => `
                <div class="tree-child-column">
                  ${this.renderTreePersonOrCouple(c, `COUSIN (${c.nickname || "Cousin"})`)}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(azhar, "UNCLE (AZHAR)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(norita, "AUNT (NORITA)")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill" data-target="branch-az" data-count="2">
                <i class="fa-solid fa-minus"></i> 2 Children
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-az">
              ${az_kids
                .map(
                  (c) => `
                <div class="tree-child-column">
                  ${this.renderTreePersonOrCouple(c, `COUSIN (${c.nickname || "Cousin"})`)}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

${includeCore ? `${includeCore ? `          <div class="tree-child-column">
            <div class="tree-couple-box" style="padding: 10px; background: #fffdf7; border: 2px dashed #f59e0b; border-radius: 20px;">
              ${this.renderTreeMemberNode(mom, "MOTHER (SHAFRAH)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(dad, "FATHER (ABD RAHIM)")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill active-core" data-target="branch-core-m" data-count="5">
                <i class="fa-solid fa-minus"></i> 5 Siblings (Core)
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-core-m">
              <div class="tree-child-column">
                <div class="tree-couple-box">
                  ${this.renderTreeMemberNode(asyraf, "BROTHER (ASYRAF)")}
                  <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
                  ${this.renderTreeMemberNode(esyha, "SISTER-IN-LAW")}
                </div>
                <div class="tree-branch-connector">
                  <div class="tree-stem-down"></div>
                  <button class="tree-toggle-pill" data-target="branch-nieces-m" data-count="2">
                    <i class="fa-solid fa-minus"></i> 2 Nieces (Gen 4)
                  </button>
                </div>
                <div class="tree-children-wrapper" id="branch-nieces-m">
                  ${nieces
                    .map(
                      (nc) => `
                    <div class="tree-child-column">
                      ${this.renderTreeMemberNode(nc, `NIECE (${nc.age} YRS)`)}
                    </div>
                  `
                    )
                    .join("")}
                </div>
              </div>

              <div class="tree-child-column">
                ${this.renderTreePersonOrCouple(this.getPerson("c_aliah"), "SISTER (ALIAH)")}
              </div>

              <div class="tree-child-column">
                ${this.renderTreePersonOrCouple(this.getPerson("c_aqilah"), "SISTER (AQILAH)")}
              </div>

              <div class="tree-child-column">
                ${this.renderTreePersonOrCouple(this.getPerson("c_adilah"), "SISTER (ADILAH)")}
              </div>

              <div class="tree-child-column">
                ${this.renderTreePersonOrCouple(this.getPerson("c_ammar"), "ME (AMMAR)")}
              </div>
            </div>
          </div>` : ""}` : ""}

          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(mazri, "UNCLE (MAZRI)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(nordin, "AUNT (NORDIN)")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill" data-target="branch-mz" data-count="5">
                <i class="fa-solid fa-minus"></i> 5 Children
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-mz">
              ${mz_kids
                .map(
                  (c) => `
                <div class="tree-child-column">
                  ${this.renderTreePersonOrCouple(c, `COUSIN (${c.nickname || "Cousin"})`)}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(yusma, "AUNT (YUSMA)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(hamzah, "UNCLE (HAMZAH)")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill" data-target="branch-ym" data-count="3">
                <i class="fa-solid fa-minus"></i> 3 Children
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-ym">
              ${ym_kids
                .map(
                  (c) => `
                <div class="tree-child-column">
                  ${this.renderTreePersonOrCouple(c, `COUSIN (${c.nickname || "Cousin"})`)}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

        </div>
      </div>
    `;
  },

  buildDirectPedigreeTree() {
    const isa = this.getPerson("p_isa");
    const zaharah = this.getPerson("p_zaharah");
    const zain = this.getPerson("m_zain");
    const noraini = this.getPerson("m_noraini");
    const dad = this.getPerson("d_dad");
    const mom = this.getPerson("m_shafrah");

    const asyraf = this.getPerson("c_asyraf");
    const esyha = this.getPerson("c_esyha");
    const nieces = ["g4_aisy", "g4_ayesha"].map((id) => this.getPerson(id)).filter(Boolean);

    return `
      <div style="display:flex; gap:120px; justify-content:center;">
        <div class="tree-branch">
          <div style="font-size:11px; font-weight:800; color:var(--paternal); margin-bottom:8px;">PATERNAL GRANDPARENTS (DAD'S SIDE)</div>
          <div class="tree-couple-box">
            ${this.renderTreeMemberNode(isa, "GRANDFATHER")}
            <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
            ${this.renderTreeMemberNode(zaharah, "GRANDMOTHER")}
          </div>
          <div class="tree-stem-down" style="height:40px;"></div>
        </div>

        <div class="tree-branch">
          <div style="font-size:11px; font-weight:800; color:var(--maternal); margin-bottom:8px;">MATERNAL GRANDPARENTS (MOM'S SIDE)</div>
          <div class="tree-couple-box">
            ${this.renderTreeMemberNode(zain, "GRANDFATHER")}
            <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
            ${this.renderTreeMemberNode(noraini, "GRANDMOTHER")}
          </div>
          <div class="tree-stem-down" style="height:40px;"></div>
        </div>
      </div>

      <div class="tree-branch">
        <div class="tree-couple-box" style="padding: 12px; background: #fffdf7; border: 2.5px solid #f59e0b; border-radius: 20px; box-shadow: 0 10px 25px rgba(245,158,11,0.15);">
          ${this.renderTreeMemberNode(mom, "MOTHER (SHAFRAH)")}
          <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
          ${this.renderTreeMemberNode(dad, "FATHER (ABD RAHIM)")}
        </div>

        <div class="tree-branch-connector">
          <div class="tree-stem-down"></div>
          <button class="tree-toggle-pill active-core" data-target="branch-pedigree-children" data-count="5">
            <i class="fa-solid fa-minus"></i> 5 Siblings
          </button>
        </div>

        <div class="tree-children-wrapper" id="branch-pedigree-children">
          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(asyraf, "BROTHER (ASYRAF)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(esyha, "SISTER-IN-LAW")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill" data-target="branch-pedigree-nieces" data-count="2">
                <i class="fa-solid fa-minus"></i> 2 Nieces
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-pedigree-nieces">
              ${nieces
                .map(
                  (nc) => `
                <div class="tree-child-column">
                  ${this.renderTreeMemberNode(nc, `NIECE (${nc.age} YRS)`)}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="tree-child-column">
            ${this.renderTreePersonOrCouple(this.getPerson("c_aliah"), "SISTER (ALIAH)")}
          </div>

          <div class="tree-child-column">
            ${this.renderTreePersonOrCouple(this.getPerson("c_aqilah"), "SISTER (AQILAH)")}
          </div>

          <div class="tree-child-column">
            ${this.renderTreePersonOrCouple(this.getPerson("c_adilah"), "SISTER (ADILAH)")}
          </div>

          <div class="tree-child-column">
            ${this.renderTreePersonOrCouple(this.getPerson("c_ammar"), "ME (AMMAR)")}
          </div>
        </div>
      </div>
    `;
  },


  buildCoreFamilyTree() {
    const dad = this.getPerson("d_dad");
    const mom = this.getPerson("m_shafrah");
    const asyraf = this.getPerson("c_asyraf");
    const esyha = this.getPerson("c_esyha");
    const nieces = ["g4_aisy", "g4_ayesha"].map((id) => this.getPerson(id)).filter(Boolean);

    return `
      <div class="tree-branch">
        <div class="tree-couple-box" style="padding: 12px; background: #fffdf7; border: 2.5px solid #f59e0b; border-radius: 20px; box-shadow: 0 10px 25px rgba(245,158,11,0.15);">
          ${this.renderTreeMemberNode(mom, "MOTHER (SHAFRAH)")}
          <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
          ${this.renderTreeMemberNode(dad, "FATHER (ABD RAHIM)")}
        </div>

        <div class="tree-branch-connector">
          <div class="tree-stem-down"></div>
          <button class="tree-toggle-pill active-core" data-target="branch-pedigree-children" data-count="5">
            <i class="fa-solid fa-minus"></i> 5 Siblings
          </button>
        </div>

        <div class="tree-children-wrapper" id="branch-pedigree-children">
          <div class="tree-child-column">
            <div class="tree-couple-box">
              ${this.renderTreeMemberNode(asyraf, "BROTHER (ASYRAF)")}
              <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
              ${this.renderTreeMemberNode(esyha, "SISTER-IN-LAW")}
            </div>
            <div class="tree-branch-connector">
              <div class="tree-stem-down"></div>
              <button class="tree-toggle-pill" data-target="branch-pedigree-nieces" data-count="2">
                <i class="fa-solid fa-minus"></i> 2 Nieces
              </button>
            </div>
            <div class="tree-children-wrapper" id="branch-pedigree-nieces">
              ${nieces
                .map(
                  (nc) => `
                <div class="tree-child-column">
                  ${this.renderTreeMemberNode(nc, `NIECE (${nc.age} YRS)`)}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="tree-child-column">
            ${this.renderTreePersonOrCouple(this.getPerson("c_aliah"), "SISTER (ALIAH)")}
          </div>

          <div class="tree-child-column">
            ${this.renderTreePersonOrCouple(this.getPerson("c_aqilah"), "SISTER (AQILAH)")}
          </div>

          <div class="tree-child-column">
            ${this.renderTreePersonOrCouple(this.getPerson("c_adilah"), "SISTER (ADILAH)")}
          </div>

          <div class="tree-child-column">
            ${this.renderTreePersonOrCouple(this.getPerson("c_ammar"), "ME (AMMAR)")}
          </div>
        </div>
      </div>
    `;
  },



  buildCombinedFamilyTree() {
    const zainal = this.getPerson("m_zainal");
    const nolina = this.getPerson("m_nolina");
    const znKids = ["m_zn_amelia", "m_zn_alysaa", "m_zn_alany", "m_zn_hilman"].map((id) => this.getPerson(id)).filter(Boolean);

    const azhar = this.getPerson("m_azhar");
    const norita = this.getPerson("m_norita");
    const azKids = ["m_az_hairie", "m_az_syalina"].map((id) => this.getPerson(id)).filter(Boolean);

    const mazri = this.getPerson("m_mazri");
    const nordin = this.getPerson("m_mazri_s");
    const mzKids = ["m_mz_izzat", "m_mz_izzudin", "m_mz_aiman", "m_mz_airin", "m_mz_aisyah"].map((id) => this.getPerson(id)).filter(Boolean);

    const yusma = this.getPerson("m_yusma");
    const hamzah = this.getPerson("m_hamzah");
    const ymKids = ["m_ym_hafizah", "m_ym_hidayah", "m_ym_izzah"].map((id) => this.getPerson(id)).filter(Boolean);

    const paklong = this.getPerson("d_paklong");
    const maklong = this.getPerson("d_paklong_w");
    const plKids = ["d_pl_c1", "d_pl_c2", "d_pl_c3", "d_pl_c4"].map((id) => this.getPerson(id)).filter(Boolean);

    const pakngah = this.getPerson("d_pakngah");
    const makngah = this.getPerson("d_pakngah_w");
    const pnKids = ["d_pn_c1", "d_pn_c2", "d_pn_c3", "d_pn_c4"].map((id) => this.getPerson(id)).filter(Boolean);

    const makteh = this.getPerson("d_makteh");
    const mtKids = ["d_mt_ika", "d_mt_miza", "d_mt_ain", "d_mt_mirul"].map((id) => this.getPerson(id)).filter(Boolean);

    const aciknora = this.getPerson("d_aciknora");
    const izzan = this.getPerson("d_izzan");

    const maksulaili = this.getPerson("d_maksulaili");
    const azman = this.getPerson("d_azman");
    const msKids = ["d_ms_c1", "d_ms_c2", "d_ms_c3", "d_ms_c4", "d_ms_c5", "d_ms_c6", "d_ms_c7"].map((id) => this.getPerson(id)).filter(Boolean);

    const dad = this.getPerson("d_dad");
    const mom = this.getPerson("m_shafrah");
    const asyraf = this.getPerson("c_asyraf");
    const esyha = this.getPerson("c_esyha");
    const nieces = ["g4_aisy", "g4_ayesha"].map((id) => this.getPerson(id)).filter(Boolean);

    const maternalUnit = (left, right, kids, target, count, label) => `
      <div class="tree-child-column">
        <div class="tree-couple-box">
          ${this.renderTreeMemberNode(left, label)}
          ${right ? `<div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>${this.renderTreeMemberNode(right, label.replace("UNCLE", "AUNT").replace("AUNT", "AUNT"))}` : ""}
        </div>
        ${kids.length ? `
          <div class="tree-branch-connector">
            <div class="tree-stem-down"></div>
            <button class="tree-toggle-pill" data-target="${target}" data-count="${count}">
              <i class="fa-solid fa-minus"></i> ${count} Children
            </button>
          </div>
          <div class="tree-children-wrapper" id="${target}">
            ${kids.map((c) => `<div class="tree-child-column">${this.renderTreeMemberNode(c, "CHILD")}</div>`).join("")}
          </div>
        ` : ""}
      </div>
    `;

    return `
      <div style="display:flex; gap:24px; justify-content:center; align-items:flex-start; flex-wrap:nowrap; overflow-x:auto; width:100%; padding-bottom:12px;">
        <div style="display:flex; flex-direction:row; flex-wrap:wrap; gap:18px; justify-content:center; align-items:flex-start; min-width:260px; max-width:420px;">
          <div style="width:100%; font-size:12px; font-weight:800; color:var(--maternal); text-align:center;">MOM'S SIDE</div>
          ${maternalUnit(zainal, nolina, znKids, "branch-zn", 4, "UNCLE (ZAINAL)")}
          ${maternalUnit(azhar, norita, azKids, "branch-az", 2, "UNCLE (AZHAR)")}
          ${maternalUnit(mazri, nordin, mzKids, "branch-mz", 5, "UNCLE (MAZRI)")}
          ${maternalUnit(yusma, hamzah, ymKids, "branch-ym", 3, "AUNT (YUSMA)")}
        </div>

        <div style="display:flex; flex-direction:column; align-items:center; min-width:300px;">
          <div style="font-size:12px; font-weight:800; color:var(--gold); margin-bottom:8px;">MY FAMILY</div>
          <div class="tree-couple-box" style="padding: 12px; background: #fffdf7; border: 2.5px solid #f59e0b; border-radius: 20px; box-shadow: 0 10px 25px rgba(245,158,11,0.15);">
            ${this.renderTreeMemberNode(mom, "MOTHER (SHAFRAH)")}
            <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
            ${this.renderTreeMemberNode(dad, "FATHER (ABD RAHIM)")}
          </div>
          <div class="tree-branch-connector">
            <div class="tree-stem-down"></div>
            <button class="tree-toggle-pill active-core" data-target="branch-pedigree-children" data-count="5">
              <i class="fa-solid fa-minus"></i> 5 Siblings
            </button>
          </div>
          <div class="tree-children-wrapper" id="branch-pedigree-children">
            <div class="tree-child-column">
              <div class="tree-couple-box">
                ${this.renderTreeMemberNode(asyraf, "BROTHER (ASYRAF)")}
                <div class="tree-marriage-bridge"><i class="fa-solid fa-heart"></i></div>
                ${this.renderTreeMemberNode(esyha, "SISTER-IN-LAW")}
              </div>
              <div class="tree-branch-connector">
                <div class="tree-stem-down"></div>
                <button class="tree-toggle-pill" data-target="branch-pedigree-nieces" data-count="2">
                  <i class="fa-solid fa-minus"></i> 2 Nieces
                </button>
              </div>
              <div class="tree-children-wrapper" id="branch-pedigree-nieces">
                ${nieces.map((nc) => `<div class="tree-child-column">${this.renderTreeMemberNode(nc, `NIECE (${nc.age} YRS)`)}</div>`).join("")}
              </div>
            </div>
            <div class="tree-child-column">${this.renderTreePersonOrCouple(this.getPerson("c_aliah"), "SISTER (ALIAH)")}</div>
            <div class="tree-child-column">${this.renderTreePersonOrCouple(this.getPerson("c_aqilah"), "SISTER (AQILAH)")}</div>
            <div class="tree-child-column">${this.renderTreePersonOrCouple(this.getPerson("c_adilah"), "SISTER (ADILAH)")}</div>
            <div class="tree-child-column">${this.renderTreePersonOrCouple(this.getPerson("c_ammar"), "ME (AMMAR)")}</div>
          </div>
        </div>

        <div style="display:flex; flex-direction:row; flex-wrap:wrap; gap:18px; justify-content:center; align-items:flex-start; min-width:260px; max-width:420px;">
          <div style="width:100%; font-size:12px; font-weight:800; color:var(--primary); text-align:center;">DAD'S SIDE</div>
          ${maternalUnit(paklong, maklong, plKids, "branch-pl", 4, "UNCLE (PAKLONG)")}
          ${maternalUnit(pakngah, makngah, pnKids, "branch-pn", 4, "UNCLE (PAKNGAH)")}
          ${maternalUnit(makteh, this.getSpouses(makteh)[0] || null, mtKids, "branch-mt", mtKids.length, "AUNT (MAKTEH)")}
          ${maternalUnit(aciknora, izzan, [], "branch-an", 0, "AUNT (ACIK NORA)")}
          ${maternalUnit(maksulaili, azman, msKids, "branch-ms", 7, "AUNT (MAKSU LAILI)")}
        </div>
      </div>
    `;
  },

  attachTreeInteractions(container) {
    // Branch toggles
    container.querySelectorAll(".tree-toggle-pill").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetId = btn.dataset.target;
        const targetEl = document.getElementById(targetId);
        const count = btn.dataset.count || "";

        if (targetEl) {
          const isCollapsed = targetEl.classList.toggle("collapsed");
          btn.classList.toggle("collapsed", isCollapsed);

          if (isCollapsed) {
            btn.innerHTML = `<i class="fa-solid fa-plus"></i> ${count} Children`;
          } else {
            btn.innerHTML = `<i class="fa-solid fa-minus"></i> ${count} Children`;
          }
        }
      });
    });

    // Member card click -> view profile
    container.querySelectorAll(".tree-member[data-id]").forEach((card) => {
      card.addEventListener("click", () => {
        this.openPersonModal(card.dataset.id);
      });
    });
  },

  /* ==========================================================================
     REDESIGNED MEMBER DIRECTORY SYSTEM (MODERN EXECUTIVE CARDS & VIEW ENGINE)
     ========================================================================== */
  getRelationToAmmar(p) {
    if (p.id === "c_ammar") {
      return { text: "ME (Developer)", icon: "fa-crown", cls: "me" };
    }
    if (p.id === "d_dad") {
      return { text: "Father (Ayah)", icon: "fa-user-tie", cls: "parent" };
    }
    if (p.id === "m_shafrah") {
      return { text: "Mother (Ibu)", icon: "fa-heart", cls: "parent" };
    }
    if (p.id === "c_asyraf") {
      return { text: "Eldest Brother", icon: "fa-user-group", cls: "sibling" };
    }
    if (["c_aliah", "c_aqilah", "c_adilah"].includes(p.id)) {
      return { text: "Elder Sister", icon: "fa-user-group", cls: "sibling" };
    }
    if (p.id === "c_esyha") {
      return { text: "Sister-in-law", icon: "fa-ring", cls: "inlaw" };
    }
    if (["g4_aisy", "g4_ayesha"].includes(p.id)) {
      return { text: "Niece (Gen 4)", icon: "fa-wand-magic-sparkles", cls: "niece" };
    }
    if (["p_isa", "m_zain"].includes(p.id)) {
      return { text: "Grandfather (Atok)", icon: "fa-monument", cls: "grandparent" };
    }
    if (["p_zaharah", "m_noraini"].includes(p.id)) {
      return { text: "Grandmother (Nenek)", icon: "fa-monument", cls: "grandparent" };
    }

    if (p.generation === 2) {
      if (p.branch === "paternal") {
        return {
          text: p.gender === "male" ? "Paternal Uncle" : "Paternal Aunt",
          icon: "fa-people-roof",
          cls: "auntuncle",
        };
      } else {
        return {
          text: p.gender === "male" ? "Maternal Uncle" : "Maternal Aunt",
          icon: "fa-people-roof",
          cls: "auntuncle",
        };
      }
    }

    if (p.generation === 3) {
      return {
        text: p.branch === "paternal" ? "1st Cousin (Dad's side)" : "1st Cousin (Mom's side)",
        icon: "fa-user-check",
        cls: "cousin",
      };
    }

    if (p.generation === 4) {
      return { text: "Next-Gen Relative", icon: "fa-child", cls: "niece" };
    }

    return { text: `Gen ${p.generation} Relative`, icon: "fa-user", cls: "default" };
  },

  getGenealogySnippet(p) {
    const father = p.fatherId ? this.getPerson(p.fatherId) : null;
    const mother = p.motherId ? this.getPerson(p.motherId) : null;
    const spouses = (p.spouses || []).map((id) => this.getPerson(id)).filter(Boolean);
    const children = (p.children || []).map((id) => this.getPerson(id)).filter(Boolean);

    let parts = [];

    if (father || mother) {
      const pNames = [
        father?.nickname || father?.name?.split(" ")[0],
        mother?.nickname || mother?.name?.split(" ")[0],
      ].filter(Boolean).join(" & ");
      parts.push(`Child of ${pNames}`);
    }

    if (spouses.length) {
      const sNames = spouses.map((s) => s.nickname || s.name.split(" ")[0]).join(" & ");
      parts.push(`Spouse: ${sNames}`);
    }

    if (children.length) {
      parts.push(`${children.length} Children`);
    }

    if (!parts.length) {
      return p.bio || `Documented Gen ${p.generation} Family Member`;
    }

    return parts.join(" · ");
  },

  locatePersonInTree(id) {
    const person = this.getPerson(id);
    if (!person) return;

    // Other pages hand over to the Family Tree page, which spotlights the person there.
    if (!document.getElementById("treeContainer")) {
      window.location.href = `family.html?locate=${encodeURIComponent(id)}`;
      return;
    }

    if (person.branch === "maternal") {
      this.treeLineage = "maternal";
    } else if (person.branch === "paternal") {
      this.treeLineage = "paternal";
    } else {
      this.treeLineage = "core";
    }

    // Update lineage buttons in UI
    document.querySelectorAll(".lineage-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lineage === this.treeLineage);
    });

    // Switch to visual tree tab
    this.switchTab("tree");

    // Unfold branches if collapsed
    document.querySelectorAll(".tree-children.collapsed").forEach((el) => {
      if (el.querySelector(`[data-id="${id}"]`)) {
        el.classList.remove("collapsed");
        const btn = document.querySelector(`.tree-toggle-pill[data-target="${el.id}"]`);
        if (btn) {
          btn.classList.remove("collapsed");
          const count = btn.dataset.count || "";
          btn.innerHTML = `<i class="fa-solid fa-minus"></i> ${count} Children`;
        }
      }
    });

    // Scroll and spotlight the member node
    setTimeout(() => {
      const node = document.querySelector(`.tree-member[data-id="${id}"]`);
      if (node) {
        document.querySelectorAll(".tree-member").forEach((el) => el.classList.remove("spotlight"));
        node.classList.add("spotlight");
        node.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

        this.showToast(
          "Tree Spotlight",
          `Located ${person.name} in ${this.treeLineage.toUpperCase()} tree!`,
          "info"
        );
      }
    }, 220);
  },

  async copyMemberSummary(id) {
    const p = this.getPerson(id);
    if (!p) return;

    const rel = this.getRelationToAmmar(p);
    const summary = `${p.name} (${p.nickname || "Family Member"})\nRelation to Ammar: ${rel.text}\nGeneration: Gen ${p.generation} · ${p.branch.toUpperCase()} Lineage\nAge: ${p.age} yrs (DOB: ${p.dob || "N/A"})\nResidence: ${p.city || "Malaysia"}\nProfession: ${p.profession || "N/A"}\nHousehold: ${p.familyLabel || "Family"}`;

    try {
      await navigator.clipboard.writeText(summary);
      this.showToast("Copied to Clipboard", `Profile summary for ${p.name} copied!`, "success");
    } catch (_) {
      this.showToast("Profile Summary", `${p.name} · ${rel.text}`, "info");
    }
  },

  renderActiveFilterPills() {
    const container = document.getElementById("activeFilterBadgeContainer");
    if (!container) return;

    const pills = [];

    const familyUnit = document.getElementById("filterFamilyUnit")?.value;
    if (familyUnit && familyUnit !== "all") {
      const label = this.data.find((p) => p.familyUnit === familyUnit)?.familyLabel || familyUnit;
      pills.push({ label: `Family: ${label}`, key: "familyUnit" });
    }

    const branch = document.getElementById("filterBranch")?.value;
    if (branch && branch !== "all") {
      pills.push({ label: `Branch: ${branch.toUpperCase()}`, key: "branch" });
    }

    const gen = document.getElementById("filterGen")?.value;
    if (gen && gen !== "all") {
      pills.push({ label: `Gen ${gen}`, key: "gen" });
    }

    const gender = document.getElementById("filterGender")?.value;
    if (gender && gender !== "all") {
      pills.push({ label: `${gender.toUpperCase()}`, key: "gender" });
    }

    const city = document.getElementById("filterCity")?.value;
    if (city && city !== "all") {
      pills.push({ label: `City: ${city}`, key: "city" });
    }

    const search = document.getElementById("searchFamily")?.value?.trim();
    if (search) {
      pills.push({ label: `"${search}"`, key: "search" });
    }

    if (this.activeCohortFilter) {
      pills.push({ label: `Cohort: ${this.activeCohortFilter.toUpperCase()}`, key: "cohort" });
    }

    if (!pills.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = pills
      .map(
        (p) => `
        <span class="filter-badge-pill" data-clear-filter="${p.key}">
          ${p.label} <i class="fa-solid fa-xmark"></i>
        </span>
      `
      )
      .join("");

    container.querySelectorAll("[data-clear-filter]").forEach((el) => {
      el.addEventListener("click", () => {
        const key = el.dataset.clearFilter;
        if (key === "familyUnit") {
          document.querySelectorAll("#filterFamilyUnit").forEach((s) => (s.value = "all"));
        } else if (key === "branch") {
          document.querySelectorAll("#filterBranch").forEach((s) => (s.value = "all"));
        } else if (key === "gen") {
          document.querySelectorAll("#filterGen").forEach((s) => (s.value = "all"));
        } else if (key === "gender") {
          document.querySelectorAll("#filterGender").forEach((s) => (s.value = "all"));
        } else if (key === "city") {
          document.querySelectorAll("#filterCity").forEach((s) => (s.value = "all"));
        } else if (key === "search") {
          document.querySelectorAll("#searchFamily").forEach((i) => (i.value = ""));
        } else if (key === "cohort") {
          this.activeCohortFilter = null;
        }
        this.applyFilters();
      });
    });
  },

  renderModernMemberCard(p) {
    const initials = this.getCleanInitials(p);
    const familyUnit = p.familyUnit || "core_ammar";
    const genealogy = this.getGenealogySnippet(p);
    const isMe = p.id === "c_ammar";
    const cityText = p.city ? p.city.split(",")[0].trim() : "-";
    const dobText = p.dob || "-";
    const ageText = `${p.age || 0} yrs`;

    return `
      <article class="modern-member-card unit-${familyUnit} ${isMe ? "is-author" : ""}" data-id="${p.id}">
        <!-- Top Colored Accent Stripe -->
        <div class="card-top-accent stripe-${familyUnit}"></div>

        <div class="card-inner">
          <!-- 1. NAME & AVATAR -->
          <div class="card-member-header">
            <div class="card-avatar-container ${p.gender}">
              ${p.avatar ? `<img src="${p.avatar}" alt="${p.name}" class="avatar-img" />` : `<span class="avatar-initials">${initials}</span>`}
              ${isMe ? `<span class="card-author-badge" title="Me (App Author)"><i class="fa-solid fa-crown"></i> ME</span>` : ""}
            </div>

            <div class="card-member-names">
              <h3 class="card-name-title" title="${p.name}">${p.name}</h3>
              ${p.nickname ? `<span class="card-nickname-tag">${p.nickname}</span>` : ""}
            </div>
          </div>

          <!-- 2. BOD - AGE & 3. CITY -->
          <div class="card-meta-list">
            <div class="card-meta-row">
              <span class="card-meta-label"><i class="fa-regular fa-calendar-days"></i> BOD - AGE</span>
              <span class="card-meta-val"><b>${dobText}</b> <span class="val-sep">·</span> <b>${ageText}</b></span>
            </div>

            <div class="card-meta-row">
              <span class="card-meta-label"><i class="fa-solid fa-location-dot"></i> CITY</span>
              <span class="card-meta-val">${cityText}</span>
            </div>
          </div>

          <!-- 4. LINEAGE & KINSHIP CONTEXT -->
          <div class="card-kinship-block" title="${genealogy}">
            <div class="kinship-block-label">
              <i class="fa-solid fa-diagram-project"></i>
              <span>LINEAGE &amp; KINSHIP CONTEXT</span>
            </div>
            <div class="kinship-block-text">
              ${genealogy}
            </div>
          </div>

          <!-- 5. THE 4 ACTIONS -->
          <div class="card-action-footer">
            <button class="btn-card-action btn-tree-spotlight" data-locate-tree-id="${p.id}" type="button" title="Spotlight ${p.name} on Visual Family Tree">
              <i class="fa-solid fa-crosshairs"></i> Tree
            </button>
            <button class="btn-card-action btn-edit-card" data-edit-id="${p.id}" type="button" title="Fast Edit Profile &amp; Photo">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="btn-card-action btn-view-card" data-view-id="${p.id}" type="button" title="View Full Member Profile">
              <i class="fa-solid fa-id-card-clip"></i> Profile
            </button>
            <button class="btn-card-action btn-copy-card" data-copy-id="${p.id}" type="button" title="Copy Profile to Clipboard">
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  },

  renderDirectoryGroupedView() {
    const groupsMap = {};
    this.filtered.forEach((p) => {
      const uId = p.familyUnit || "core_ammar";
      const uLabel = p.familyLabel || "Keluarga";
      if (!groupsMap[uId]) {
        groupsMap[uId] = {
          id: uId,
          label: uLabel,
          members: [],
        };
      }
      groupsMap[uId].members.push(p);
    });

    const groupsList = Object.values(groupsMap).sort((a, b) => b.members.length - a.members.length);

    return groupsList
      .map((g) => {
        const headNames =
          g.members
            .filter((m) => m.generation <= 2)
            .slice(0, 2)
            .map((m) => m.nickname || m.name.split(" ")[0])
            .join(" & ") || g.members[0]?.nickname || "Family Head";

        return `
          <div class="family-group-section unit-${g.id}">
            <div class="family-group-header">
              <div class="family-group-title">
                <span class="card-family-badge badge-${g.id}" style="font-size:13px; padding:5px 12px;">
                  <i class="fa-solid fa-house-chimney-window"></i> ${g.label}
                </span>
                <span style="font-size:12px; color:var(--text-muted); font-weight:700;">
                  (Household Heads: <b>${headNames}</b>)
                </span>
              </div>
              <span class="badge badge-age" style="font-weight:800; font-size:12px;">
                ${g.members.length} relatives
              </span>
            </div>
            <div class="family-group-cards">
              ${g.members
                .slice()
                .sort((a, b) => (a.generation || 0) - (b.generation || 0) || a.name.localeCompare(b.name))
                .map((p) => this.renderModernMemberCard(p))
                .join("")}
            </div>
          </div>
        `;
      })
      .join("");
  },

  renderDirectoryTableView() {
    return `
      <div class="directory-table-wrapper">
        <table class="directory-table">
          <thead>
            <tr>
              <th class="col-member">MEMBER</th>
              <th class="col-household">HOUSEHOLD</th>
              <th class="col-bod">BOD</th>
              <th class="col-city">CITY</th>
              <th class="col-action" style="text-align:right;">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${this.filtered
              .slice()
              .sort((a, b) => (a.generation || 0) - (b.generation || 0) || a.name.localeCompare(b.name))
              .map((p) => {
                const initials = this.getCleanInitials(p);
                const familyUnit = p.familyUnit || "core_ammar";
                const familyLabel = p.familyLabel || "Keluarga";
                const isMe = p.id === "c_ammar";

                return `
                  <tr data-id="${p.id}" class="${isMe ? "is-author" : ""}">
                    <td class="col-member">
                      <div class="table-member-cell" style="display:flex; align-items:center; gap:10px;">
                        <div class="card-avatar-container ${p.gender}" style="width:38px; height:38px; min-width:38px; font-size:12px; margin-bottom:0;">
                          ${p.avatar ? `<img src="${p.avatar}" alt="${p.name}" class="avatar-img" />` : `<span class="avatar-initials" style="font-size:12px;">${initials}</span>`}
                        </div>
                        <div class="table-member-info">
                          <strong class="table-member-name" style="display:block; color:#0f172a; font-size:13px; font-weight:700;">${p.name}${isMe ? ` <span style="font-size:10px; background:#b58b3f; color:#fff; padding:1px 6px; border-radius:4px;"><i class="fa-solid fa-crown"></i> ME</span>` : ""}</strong>
                          ${p.nickname ? `<span class="table-member-nickname" style="font-size:11px; color:#64748b;">(${p.nickname})</span>` : ""}
                        </div>
                      </div>
                    </td>
                    <td class="col-household">
                      <span class="card-family-badge badge-${familyUnit}" style="font-size:11px; padding:3px 9px;">
                        <i class="fa-solid fa-house-chimney-window"></i> ${familyLabel}
                      </span>
                    </td>
                    <td class="col-bod">
                      <div class="table-bod-cell">
                        <span class="table-age-val" style="display:block; font-size:12px; font-weight:700;"><b>${p.age || "-"}</b> yrs</span>
                        <small class="table-dob-val" style="color:#64748b; font-size:11px;">${p.dob || "-"}</small>
                      </div>
                    </td>
                    <td class="col-city">
                      <span class="table-city-badge" style="font-size:12px;">${p.city ? p.city.split(",")[0] : "-"}</span>
                    </td>
                    <td class="col-action" style="text-align:right;">
                      <div class="table-action-btns" style="display:inline-flex; gap:6px;">
                        <button class="btn-card-action btn-tree-spotlight" data-locate-tree-id="${p.id}" type="button" title="Spotlight ${p.name} on Tree" style="padding:4px 8px; font-size:11px;">
                          <i class="fa-solid fa-crosshairs"></i> Tree
                        </button>
                        <button class="btn-card-action btn-edit-card" data-edit-id="${p.id}" type="button" title="Edit Profile" style="padding:4px 8px; font-size:11px;">
                          <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                        <button class="btn-card-action btn-view-card" data-view-id="${p.id}" type="button" title="View Profile" style="padding:4px 8px; font-size:11px;">
                          <i class="fa-solid fa-id-card-clip"></i> Profile
                        </button>
                        <button class="btn-card-action btn-copy-card" data-copy-id="${p.id}" type="button" title="Copy Info" style="padding:4px 8px; font-size:11px;">
                          <i class="fa-solid fa-copy"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  },

  renderDirectory() {
    const container = document.getElementById("directoryGrid");
    if (!container) return;

    // Update subheader counters
    const visCountEl = document.getElementById("dirVisibleCount");
    const totCountEl = document.getElementById("dirTotalCount");
    if (visCountEl) visCountEl.textContent = this.filtered.length;
    if (totCountEl) totCountEl.textContent = this.data.length;

    // Update active filter badge tags
    this.renderActiveFilterPills();

    if (this.filtered.length === 0) {
      container.innerHTML = `
        <div class="directory-empty-state">
          <div class="empty-icon"><i class="fa-solid fa-user-slash"></i></div>
          <h3>No Family Members Found</h3>
          <p>No relatives match your active filter and search keywords. Reset filters to explore all 64 documented relatives.</p>
          <button class="btn-primary" type="button" onclick="FamilyApp.resetFilters()">
            <i class="fa-solid fa-rotate-left"></i> Reset All Filters
          </button>
        </div>
      `;
      return;
    }

    if (this.directoryViewMode === "table") {
      container.innerHTML = this.renderDirectoryTableView();
    } else if (this.directoryViewMode === "grouped") {
      container.innerHTML = this.renderDirectoryGroupedView();
    } else {
      // Default: Modern Cards Grid
      container.innerHTML = `
        <div class="cards-grid">
          ${this.filtered.map((p) => this.renderModernMemberCard(p)).join("")}
        </div>
      `;
    }

    this.attachDirectoryEventListeners(container);
  },

  attachDirectoryEventListeners(container) {
    // 1. Locate in Tree button listeners
    container.querySelectorAll("[data-locate-tree-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.locatePersonInTree(btn.dataset.locateTreeId);
      });
    });

    // 2. Edit Profile button listeners
    container.querySelectorAll("[data-edit-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openEditModal(btn.dataset.editId);
      });
    });

    // 3. View Full Profile button listeners
    container.querySelectorAll("[data-view-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openPersonModal(btn.dataset.viewId);
      });
    });

    // 4. Copy Summary button listeners
    container.querySelectorAll("[data-copy-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.copyMemberSummary(btn.dataset.copyId);
      });
    });

    // 5. Card click -> open profile modal
    container.querySelectorAll(".modern-member-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button") || e.target.closest("a")) return;
        this.openPersonModal(card.dataset.id);
      });
    });

    // 6. Setup 3D Card tilt
    this.setup3dCardTilt();
  },

  /* ==========================================================================
     3D CARD TILT INTERACTIVE MOTION (EMIL KOWALSKI PERFORMANCE COMPLIANT)
     ========================================================================== */
  setup3dCardTilt() {
    const cards = document.querySelectorAll(".modern-member-card");
    cards.forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const midX = rect.width / 2;
        const midY = rect.height / 2;
        const rotateX = (((y - midY) / midY) * -5).toFixed(2);
        const rotateY = (((x - midX) / midX) * 5).toFixed(2);

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      });

      card.addEventListener("mouseleave", () => {
        card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)";
      });
    });
  },

  /* ==========================================================================
     ADVANCED HERITAGE INTELLIGENCE & DEMOGRAPHIC DASHBOARD
     ========================================================================== */
  renderStatsView() {
    const container = document.getElementById("statsContainer");
    if (!container) return;

    const people = this.data;
    const total = people.length;
    const males = people.filter((p) => p.gender === "male").length;
    const females = people.filter((p) => p.gender === "female").length;
    const paternalCount = people.filter((p) => p.branch === "paternal").length;
    const maternalCount = people.filter((p) => p.branch === "maternal").length;
    const immediateCount = people.filter((p) => p.branch === "immediate").length;

    const validAges = people.map((p) => p.age).filter((a) => typeof a === "number" && !isNaN(a));
    const avgAge = validAges.length ? (validAges.reduce((a, b) => a + b, 0) / validAges.length).toFixed(1) : 0;
    const minAge = validAges.length ? Math.min(...validAges) : 0;
    const maxAge = validAges.length ? Math.max(...validAges) : 0;

    // Age Cohorts
    const elders = people.filter((p) => p.age >= 60).length;
    const adults = people.filter((p) => p.age >= 35 && p.age < 60).length;
    const youth = people.filter((p) => p.age >= 18 && p.age < 35).length;
    const kids = people.filter((p) => p.age < 18).length;

    // Generations
    const gen1 = people.filter((p) => p.generation === 1).length;
    const gen2 = people.filter((p) => p.generation === 2).length;
    const gen3 = people.filter((p) => p.generation === 3).length;
    const gen4 = people.filter((p) => p.generation === 4).length;

    // Grouping by Family Units
    const familyUnitsMap = {};
    people.forEach((p) => {
      const fId = p.familyUnit || "core_ammar";
      const label = p.familyLabel || "Keluarga";
      if (!familyUnitsMap[fId]) {
        familyUnitsMap[fId] = { id: fId, label, count: 0, members: [] };
      }
      familyUnitsMap[fId].count++;
      familyUnitsMap[fId].members.push(p);
    });
    const familyUnitsList = Object.values(familyUnitsMap).sort((a, b) => b.count - a.count);

    // Geographic Footprint (Malaysian Cities)
    const cityMap = {};
    people.forEach((p) => {
      if (p.city) {
        const town = p.city.split(",")[0].trim();
        cityMap[town] = (cityMap[town] || 0) + 1;
      }
    });

    // Upcoming Birthdays
    const birthdays = people
      .filter((p) => p.dob)
      .map((p) => {
        let mIdx = 0;
        let day = 1;
        const parts = p.dob.split("-");
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            mIdx = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
          } else if (parts[2].length === 4) {
            day = parseInt(parts[0], 10);
            mIdx = this.monthsList.indexOf(parts[1].toUpperCase());
            if (mIdx === -1) mIdx = 0;
          }
        }
        return {
          ...p,
          bMonthIdx: mIdx,
          bDay: day,
          bDateText: `${String(day).padStart(2, "0")} ${this.monthsList[mIdx]}`,
        };
      })
      .sort((a, b) => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const aDiff = (a.bMonthIdx - currentMonth + 12) % 12;
        const bDiff = (b.bMonthIdx - currentMonth + 12) % 12;
        if (aDiff !== bDiff) return aDiff - bDiff;
        return a.bDay - b.bDay;
      })
      .slice(0, 6);

    // SVG Donut Chart Calculation (Circumference = 2 * PI * 40 = 251.32)
    const circ = 251.32;
    const patPct = paternalCount / total;
    const matPct = maternalCount / total;
    const immPct = immediateCount / total;

    const patDash = (patPct * circ).toFixed(1);
    const matDash = (matPct * circ).toFixed(1);
    const immDash = (immPct * circ).toFixed(1);

    const patOffset = 0;
    const matOffset = -patDash;
    const immOffset = -(parseFloat(patDash) + parseFloat(matDash));

    container.innerHTML = `
      <!-- Executive Summary Header -->
      <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:10px;">
        <div>
          <h2 style="margin:0; font-size:20px; color:#0f172a; font-weight:850; letter-spacing:-0.02em;">
            <i class="fa-solid fa-chart-pie" style="color:#0d9488; margin-right:8px;"></i>
            Family Heritage Intelligence &amp; Demographics
          </h2>
          <p style="margin:4px 0 0; color:var(--text-muted); font-size:13px;">
            Dynamic real-time analytics across all <b>${total} documented relatives</b> in Muhammad Ammar Syaathir's lineage.
          </p>
        </div>
        <div style="font-size:12px; font-weight:750; color:#0d9488; background:#f0fdfa; border:1px solid #99f6e4; padding:6px 12px; border-radius:99px;">
          <i class="fa-solid fa-bolt"></i> Live Reactive Compute
        </div>
      </div>

      <!-- 6 Executive KPI Metrics Cards -->
      <div class="dashboard-kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon emerald"><i class="fa-solid fa-users"></i></div>
          <div>
            <div class="kpi-value">${total}</div>
            <div class="kpi-title">Documented Members</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon blue"><i class="fa-solid fa-layer-group"></i></div>
          <div>
            <div class="kpi-value">4 Generations</div>
            <div class="kpi-title">Ancestral Span</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon purple"><i class="fa-solid fa-hourglass-half"></i></div>
          <div>
            <div class="kpi-value">${avgAge} yrs</div>
            <div class="kpi-title">Average Age</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon amber"><i class="fa-solid fa-house-chimney"></i></div>
          <div>
            <div class="kpi-value">12 Units</div>
            <div class="kpi-title">Active Households</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon rose"><i class="fa-solid fa-venus-mars"></i></div>
          <div>
            <div class="kpi-value">${males}M / ${females}F</div>
            <div class="kpi-title">Gender Balance</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon cyan"><i class="fa-solid fa-cake-candles"></i></div>
          <div>
            <div class="kpi-value">${minAge} - ${maxAge} yrs</div>
            <div class="kpi-title">Youngest to Oldest</div>
          </div>
        </div>
      </div>

      <!-- Section 1: Lineage Donut + Generation Tier Pyramid -->
      <div class="dashboard-section-grid">
        <!-- Card 1: Lineage Distribution Donut Chart -->
        <div class="dashboard-card">
          <div class="dashboard-card-header">
            <h3 class="dashboard-card-title">
              <i class="fa-solid fa-chart-donut" style="color:#2563eb;"></i> Lineage Distribution
            </h3>
            <span style="font-size:12px; color:var(--text-muted); font-weight:700;">Click pill to filter</span>
          </div>

          <div class="lineage-donut-wrapper">
            <svg width="150" height="150" viewBox="0 0 100 100" class="donut-svg">
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" stroke-width="16" />
              <!-- Paternal Segment -->
              <circle class="donut-segment" data-stats-filter-branch="paternal" cx="50" cy="50" r="40" fill="transparent" stroke="#2563eb" stroke-width="16"
                      stroke-dasharray="${patDash} ${circ}" stroke-dashoffset="${patOffset}" title="Click to view Paternal Lineage in Directory" />
              <!-- Maternal Segment -->
              <circle class="donut-segment" data-stats-filter-branch="maternal" cx="50" cy="50" r="40" fill="transparent" stroke="#d97706" stroke-width="16"
                      stroke-dasharray="${matDash} ${circ}" stroke-dashoffset="${matOffset}" title="Click to view Maternal Lineage in Directory" />
              <!-- Immediate Segment -->
              <circle class="donut-segment" data-stats-filter-branch="immediate" cx="50" cy="50" r="40" fill="transparent" stroke="#0d9488" stroke-width="16"
                      stroke-dasharray="${immDash} ${circ}" stroke-dashoffset="${immOffset}" title="Click to view Immediate Family in Directory" />
            </svg>

            <div class="donut-legend">
              <div class="donut-legend-item" style="cursor:pointer;" data-stats-filter-branch="paternal" title="Click to view Paternal Lineage in Directory">
                <span class="donut-legend-color" style="background:#2563eb;"></span>
                <span>Paternal Side (Dad): <b>${paternalCount}</b> (${(patPct * 100).toFixed(1)}%)</span>
              </div>
              <div class="donut-legend-item" style="cursor:pointer;" data-stats-filter-branch="maternal" title="Click to view Maternal Lineage in Directory">
                <span class="donut-legend-color" style="background:#d97706;"></span>
                <span>Maternal Side (Mom): <b>${maternalCount}</b> (${(matPct * 100).toFixed(1)}%)</span>
              </div>
              <div class="donut-legend-item" style="cursor:pointer;" data-stats-filter-branch="immediate" title="Click to view Immediate Family in Directory">
                <span class="donut-legend-color" style="background:#0d9488;"></span>
                <span>Immediate Core (Ammar): <b>${immediateCount}</b> (${(immPct * 100).toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Generational Tier Hierarchy Pyramid -->
        <div class="dashboard-card">
          <div class="dashboard-card-header">
            <h3 class="dashboard-card-title">
              <i class="fa-solid fa-sitemap" style="color:#7c3aed;"></i> Generational Hierarchy
            </h3>
            <span style="font-size:12px; color:var(--text-muted); font-weight:700;">Click tier to view</span>
          </div>

          <div class="gen-tier-list">
            <div class="gen-tier-item" data-stats-filter-gen="4" title="Click to view Gen 4 Nieces in Directory">
              <div class="gen-tier-header">
                <span><i class="fa-solid fa-shapes" style="color:#e11d48; margin-right:6px;"></i> Gen 4: Next-Gen Nieces</span>
                <span><b>${gen4}</b> members (${((gen4 / total) * 100).toFixed(1)}%)</span>
              </div>
              <div class="gen-tier-bar-track">
                <div class="gen-tier-bar-fill" style="width:${(gen4 / total) * 100}%; background:#e11d48;"></div>
              </div>
            </div>

            <div class="gen-tier-item" data-stats-filter-gen="3" title="Click to view Gen 3 Cousins in Directory">
              <div class="gen-tier-header">
                <span><i class="fa-solid fa-crown" style="color:#d97706; margin-right:6px;"></i> Gen 3: Ammar &amp; First Cousins</span>
                <span><b>${gen3}</b> members (${((gen3 / total) * 100).toFixed(1)}%)</span>
              </div>
              <div class="gen-tier-bar-track">
                <div class="gen-tier-bar-fill" style="width:${(gen3 / total) * 100}%; background:#0d9488;"></div>
              </div>
            </div>

            <div class="gen-tier-item" data-stats-filter-gen="2" title="Click to view Gen 2 Parents, Uncles & Aunts in Directory">
              <div class="gen-tier-header">
                <span><i class="fa-solid fa-people-roof" style="color:#2563eb; margin-right:6px;"></i> Gen 2: Parents, Uncles &amp; Aunts</span>
                <span><b>${gen2}</b> members (${((gen2 / total) * 100).toFixed(1)}%)</span>
              </div>
              <div class="gen-tier-bar-track">
                <div class="gen-tier-bar-fill" style="width:${(gen2 / total) * 100}%; background:#2563eb;"></div>
              </div>
            </div>

            <div class="gen-tier-item" data-stats-filter-gen="1" title="Click to view Gen 1 Grandparents in Directory">
              <div class="gen-tier-header">
                <span><i class="fa-solid fa-monument" style="color:#64748b; margin-right:6px;"></i> Gen 1: Grandparents &amp; Ancestors</span>
                <span><b>${gen1}</b> members (${((gen1 / total) * 100).toFixed(1)}%)</span>
              </div>
              <div class="gen-tier-bar-track">
                <div class="gen-tier-bar-fill" style="width:${(gen1 / total) * 100}%; background:#64748b;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Age Cohorts & Malaysian Geographic Footprint -->
      <div class="dashboard-section-grid">

      </div>

      <!-- Section 3: Family Units Leaderboard (12 Distinct Households) -->
      <div class="dashboard-card" style="margin-bottom:24px;">
        <div class="dashboard-card-header">
          <div>
            <h3 class="dashboard-card-title">
              <i class="fa-solid fa-house-user" style="color:#8b5cf6;"></i> Family Units Leaderboard (12 Households)
            </h3>
            <p style="margin:4px 0 0; color:var(--text-muted); font-size:12px;">
              Color-coded nuclear family units. <b>Click any family card to immediately view and filter in Member Directory.</b>
            </p>
          </div>
        </div>

        <div class="family-leaderboard-grid">
          ${familyUnitsList
            .map(
              (u) => `
            <div class="family-leader-card family-unit-${u.id}" data-stats-filter-unit="${u.id}" title="Click to filter ${u.label} in Directory">
              <div class="family-leader-count badge-${u.id}">${u.count}</div>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:800; font-size:13px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.label}</div>
                <div style="font-size:11px; color:var(--text-muted); font-weight:600;">
                  ${u.members.slice(0, 2).map((m) => m.name.split(" ")[0]).join(", ")} &amp; family
                </div>
              </div>
              <i class="fa-solid fa-chevron-right" style="color:#94a3b8; font-size:12px;"></i>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      <!-- Section 4: Upcoming Birthdays & Milestones -->
      <div class="dashboard-card">
        <div class="dashboard-card-header">
          <h3 class="dashboard-card-title">
            <i class="fa-solid fa-gift" style="color:#ec4899;"></i> Upcoming Birthdays &amp; Milestones
          </h3>
          <span style="font-size:12px; color:var(--text-muted); font-weight:700;">Chronological order</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          ${birthdays
            .map(
              (b) => `
            <div style="display:flex; align-items:center; gap:12px; padding:12px 14px; background:#fdf2f8; border:1px solid #fbcfe8; border-radius:12px;">
              <div style="width:38px; height:38px; border-radius:10px; background:#f472b6; color:#ffffff; display:grid; place-items:center; font-size:16px; flex-shrink:0;">
                <i class="fa-solid fa-cake-candles"></i>
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:800; font-size:13px; color:#831843; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${b.name}</div>
                <div style="font-size:11px; color:#9d174d; font-weight:700;">
                  ${b.bDateText} · Turning ${b.age + 1} yrs
                </div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    // Attach click listeners on dashboard items to filter Directory
    container.querySelectorAll("[data-stats-filter-branch]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const branch = btn.dataset.statsFilterBranch;
        this.filterAndNavigateToDirectory({ branch });
      });
    });

    container.querySelectorAll("[data-stats-filter-gen]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gen = btn.dataset.statsFilterGen;
        this.filterAndNavigateToDirectory({ gen });
      });
    });

    container.querySelectorAll("[data-stats-filter-unit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const unit = btn.dataset.statsFilterUnit;
        this.filterAndNavigateToDirectory({ familyUnit: unit });
      });
    });

    container.querySelectorAll("[data-stats-filter-cohort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cohort = btn.dataset.statsFilterCohort;
        this.filterAndNavigateToDirectory({ cohort });
      });
    });

    container.querySelectorAll("[data-stats-filter-city]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const city = btn.dataset.statsFilterCity;
        this.filterAndNavigateToDirectory({ city });
      });
    });
  },

  /* ==========================================================================
     MEMBER PROFILE MODAL (REDESIGNED LUXURY APPLE/LINEAR GRADE PROFILE)
     ========================================================================== */
  formatDisplayDob(rawDob) {
    if (!rawDob) return "Date unrecorded";
    const parts = rawDob.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const y = parts[0];
        const mIdx = parseInt(parts[1], 10) - 1;
        const monthWord = this.monthsList[mIdx] || parts[1];
        const d = String(parseInt(parts[2], 10)).padStart(2, "0");
        return `${d} ${monthWord} ${y}`;
      } else if (parts[2].length === 4) {
        // DD-MMM-YYYY
        const d = String(parseInt(parts[0], 10)).padStart(2, "0");
        const m = parts[1].toUpperCase();
        const y = parts[2];
        return `${d} ${m} ${y}`;
      }
    }
    return rawDob;
  },

  openPersonModal(id) {
    const person = this.getPerson(id);
    if (!person) return;

    const modal = document.getElementById("personModal");
    const title = document.getElementById("modalPersonName");
    const body = document.getElementById("modalPersonBody");

    if (title) title.textContent = `${person.name} · Profile`;

    const father = person.fatherId ? this.getPerson(person.fatherId) : null;
    const mother = person.motherId ? this.getPerson(person.motherId) : null;
    const spouses = (person.spouses || []).map((s) => ({
      ...s,
      person: this.getPerson(s.id),
    }));
    const children = (person.children || []).map((cid) => this.getPerson(cid)).filter(Boolean);
    const siblings = this.data.filter(
      (p) =>
        p.id !== person.id &&
        ((person.fatherId && p.fatherId === person.fatherId) ||
          (person.motherId && p.motherId === person.motherId))
    );

    const initials = this.getCleanInitials(person);
    const familyUnit = person.familyUnit || "core_ammar";
    const familyLabel = person.familyLabel || "Keluarga";
    const relation = this.getRelationToAmmar(person);
    const genealogy = this.getGenealogySnippet(person);
    const isMe = person.id === "c_ammar";
    const displayDob = this.formatDisplayDob(person.dob);
    const birthYear = person.dob ? (person.dob.includes("-") ? person.dob.split("-").find((x) => x.length === 4) : "") : "";

    if (body) {
      body.innerHTML = `
        <!-- Hero Cover Banner -->
        <div class="profile-hero-banner banner-${person.branch} ${isMe ? "banner-author" : ""}">
          <div class="profile-hero-main">
            <div class="profile-avatar-wrap ${person.gender}">
              ${
                person.avatar
                  ? `<img src="${person.avatar}" alt="${person.name}" class="profile-avatar-img" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
                  : `<span class="profile-avatar-placeholder"><span class="avatar-initials" style="font-size:32px; font-weight:800; color:#fff;">${initials}</span></span>`
              }
              ${isMe ? `<span class="profile-author-crown" title="Me (App Author)"><i class="fa-solid fa-crown"></i> ME</span>` : ""}
            </div>

            <div class="profile-hero-details">
              <div class="profile-hero-tags">
                <span class="profile-relation-pill rel-${relation.cls}">
                  <i class="fa-solid ${relation.icon}"></i> ${relation.text}
                </span>
                <span class="profile-household-pill badge-${familyUnit}" title="Household">
                  <i class="fa-solid fa-house-chimney-window"></i> ${familyLabel}
                </span>
              </div>

              <h2 class="profile-hero-name">${person.name}</h2>
              <div class="profile-hero-sub">
    
                <span class="profile-bullet">·</span>
                <span class="profile-gen-badge">Generation ${person.generation}</span>
              </div>

              <div class="profile-pill-strip">
                <span class="profile-meta-pill branch-${person.branch}">
                  <i class="fa-solid fa-code-branch"></i> ${person.branch.toUpperCase()} LINEAGE
                </span>
                <span class="profile-meta-pill age">
                  <i class="fa-regular fa-clock"></i> ${person.age} years old
                </span>
                <span class="profile-meta-pill gender ${person.gender}">
                  <i class="fa-solid ${person.gender === "male" ? "fa-mars" : "fa-venus"}"></i> ${person.gender === "male" ? "Male" : "Female"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Profile Body Content -->
        <div class="profile-modal-content">

          <!-- Genealogy Formula Context -->
          <div class="profile-genealogy-bar" title="${genealogy}">
            <div class="gen-bar-icon"><i class="fa-solid fa-diagram-project"></i></div>
            <div class="gen-bar-text">
              <span class="gen-bar-label">LINEAGE &amp; KINSHIP CONTEXT</span>
              <span class="gen-bar-value">${genealogy}</span>
            </div>
          </div>

          <!-- Key Vitals Grid (3 Modern Metric Cards) -->
          <div class="profile-vitals-grid">
            <div class="vital-metric-card">
              <div class="vital-icon-box blue">
                <i class="fa-solid fa-calendar-day"></i>
              </div>
              <div class="vital-info">
                <span class="vital-label">DATE OF BIRTH</span>
                <span class="vital-value">${displayDob}</span>
                <span class="vital-sub">${birthYear ? `Born ${birthYear} · ` : ""}${person.age} yrs old</span>
              </div>
            </div>

             <div class="vital-metric-card">
               <div class="vital-icon-box green">
                 <i class="fa-solid fa-location-dot"></i>
               </div>
               <div class="vital-info">
                 <span class="vital-label">CITY</span>
                 <span class="vital-value">${person.city || "Malaysia"}</span>
                 <span class="vital-sub">Documented City</span>
               </div>
             </div>

          </div>


          <!-- Kinship Network: Parents -->
          <div class="profile-kinship-section">
            <div class="kinship-sec-title">
              <i class="fa-solid fa-person-breastfeeding"></i>
              <span>Parents</span>
            </div>
            <div class="kinship-cards-grid">
              ${
                father
                  ? `
                <div class="kinship-member-card modal-jump" data-id="${father.id}">
                  <div class="kinship-avatar male">${father.avatar ? `<img src="${father.avatar}" alt="${father.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />` : this.getCleanInitials(father)}</div>
                  <div class="kinship-meta">
                    <span class="kinship-relation"><i class="fa-solid fa-mars" style="color:var(--male);"></i> Father</span>
                    <span class="kinship-name">${father.name}</span>
                    <span class="kinship-sub">${father.nickname || "Ayah"} · ${father.age} yrs</span>
                  </div>
                  <div class="kinship-arrow"><i class="fa-solid fa-chevron-right"></i></div>
                </div>
              `
                  : ""
              }
              ${
                mother
                  ? `
                <div class="kinship-member-card modal-jump" data-id="${mother.id}">
                  <div class="kinship-avatar female">${mother.avatar ? `<img src="${mother.avatar}" alt="${mother.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />` : this.getCleanInitials(mother)}</div>
                  <div class="kinship-meta">
                    <span class="kinship-relation"><i class="fa-solid fa-venus" style="color:var(--female);"></i> Mother</span>
                    <span class="kinship-name">${mother.name}</span>
                    <span class="kinship-sub">${mother.nickname || "Ibu"} · ${mother.age} yrs</span>
                  </div>
                  <div class="kinship-arrow"><i class="fa-solid fa-chevron-right"></i></div>
                </div>
              `
                  : ""
              }
              ${
                !father && !mother
                  ? `
                <div class="kinship-empty-banner">
                  <i class="fa-solid fa-landmark"></i>
                  <span>Foundational Ancestor (1st Generation Patriarch / Matriarch)</span>
                </div>
              `
                  : ""
              }
            </div>
          </div>

          <!-- Kinship Network: Spouse / Life Partner -->
          ${
            spouses.length > 0
              ? `
            <div class="profile-kinship-section">
              <div class="kinship-sec-title">
                <i class="fa-solid fa-heart" style="color:#e11d48;"></i>
                <span>Spouse / Life Partner</span>
              </div>
              <div class="kinship-cards-grid">
                ${spouses
                  .map((s) => {
                    const sp = s.person;
                    if (!sp) return "";
                    return `
                      <div class="kinship-member-card modal-jump" data-id="${sp.id}">
                        <div class="kinship-avatar ${sp.gender}">${sp.avatar ? `<img src="${sp.avatar}" alt="${sp.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />` : this.getCleanInitials(sp)}</div>
                        <div class="kinship-meta">
                          <span class="kinship-relation"><i class="fa-solid fa-ring" style="color:#e11d48;"></i> ${s.status || "Married"}</span>
                          <span class="kinship-name">${sp.name}</span>
                          <span class="kinship-sub">${sp.nickname || "Partner"} · ${sp.age} yrs</span>
                        </div>
                        <div class="kinship-arrow"><i class="fa-solid fa-chevron-right"></i></div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          <!-- Kinship Network: Children -->
          ${
            children.length > 0
              ? `
            <div class="profile-kinship-section">
              <div class="kinship-sec-title">
                <i class="fa-solid fa-children"></i>
                <span>Children (${children.length})</span>
              </div>
              <div class="kinship-chips-grid">
                ${children
                  .map(
                    (c) => `
                  <button class="kinship-chip-btn modal-jump" data-id="${c.id}" type="button">
                    <span class="chip-avatar ${c.gender}">${c.avatar ? `<img src="${c.avatar}" alt="${c.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />` : this.getCleanInitials(c)}</span>
                    <div class="chip-info">
                      <span class="chip-name">${c.name}</span>
                      <span class="chip-sub"><i class="fa-solid ${c.gender === "male" ? "fa-mars" : "fa-venus"}"></i> ${c.nickname || "Child"} · ${c.age}y</span>
                    </div>
                  </button>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          <!-- Kinship Network: Siblings -->
          ${
            siblings.length > 0
              ? `
            <div class="profile-kinship-section">
              <div class="kinship-sec-title">
                <i class="fa-solid fa-user-group"></i>
                <span>Siblings (${siblings.length})</span>
              </div>
              <div class="kinship-chips-grid">
                ${siblings
                  .map(
                    (sb) => `
                  <button class="kinship-chip-btn modal-jump" data-id="${sb.id}" type="button">
                    <span class="chip-avatar ${sb.gender}">${sb.avatar ? `<img src="${sb.avatar}" alt="${sb.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />` : this.getCleanInitials(sb)}</span>
                    <div class="chip-info">
                      <span class="chip-name">${sb.name}</span>
                      <span class="chip-sub"><i class="fa-solid ${sb.gender === "male" ? "fa-mars" : "fa-venus"}"></i> ${sb.nickname || "Sibling"} · ${sb.age}y</span>
                    </div>
                  </button>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

        </div>

        <!-- Interactive Actions Footer -->
        <div class="profile-modal-footer">
          <div class="footer-left-actions">
            <button class="btn-profile-action btn-spotlight" id="btnModalLocateTree" type="button" title="Spotlight ${person.name} on Visual Family Tree">
              <i class="fa-solid fa-crosshairs"></i> Locate in Tree
            </button>
            <button class="btn-profile-action btn-edit" id="btnModalEditProfile" type="button" title="Fast Edit Profile Information">
              <i class="fa-solid fa-pen-to-square"></i> Edit Profile
            </button>
            <button class="btn-profile-action btn-copy" id="btnModalCopySummary" type="button" title="Copy Profile Summary">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
          </div>
          <button class="btn-profile-close" id="btnModalDismiss" type="button">
            Close
          </button>
        </div>
      `;

      // Event listeners inside modal:
      // 1. Jump to relative
      body.querySelectorAll(".modal-jump").forEach((btn) => {
        btn.addEventListener("click", () => this.openPersonModal(btn.dataset.id));
      });

      // 2. Locate in visual tree
      const locateBtn = document.getElementById("btnModalLocateTree");
      if (locateBtn) {
        locateBtn.addEventListener("click", () => {
          this.closeModal();
          this.locatePersonInTree(person.id);
        });
      }

      // 3. Edit profile from within view modal
      const editFromModalBtn = document.getElementById("btnModalEditProfile");
      if (editFromModalBtn) {
        editFromModalBtn.addEventListener("click", () => {
          this.closeModal();
          this.openEditModal(person.id);
        });
      }

      // 4. Copy summary
      const copyBtn = document.getElementById("btnModalCopySummary");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          this.copyMemberSummary(person.id);
        });
      }

      // 5. Dismiss button
      const dismissBtn = document.getElementById("btnModalDismiss");
      if (dismissBtn) {
        dismissBtn.addEventListener("click", () => {
          this.closeModal();
        });
      }
    }

    if (modal) {
      modal.classList.add("open");
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
    }
  },

  closeModal() {
    const modal = document.getElementById("personModal");
    if (modal) {
      modal.classList.remove("open");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
  },

  /* ==========================================================================
     REAL-TIME AUTO-SAVE ENGINE & FAST COMPACT EDIT PROFILE MODAL
     ========================================================================== */
  triggerAutoSave(immediate = false) {
    if (!this.editingPersonId || this.isCreating) return;
    this.updateAutoSaveBadge("saving");

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (immediate) {
      this.executeAutoSave();
    } else {
      this.autoSaveTimer = setTimeout(() => {
        this.executeAutoSave();
      }, 1000);
    }
  },

  async executeAutoSave() {
    if (!this.editingPersonId || this.isCreating) return;
    const existing = this.getPerson(this.editingPersonId);
    if (!existing) return;

    const person = this.readProfileForm(existing);
    if (!person.name) return;

    const idx = this.data.findIndex((p) => p.id === this.editingPersonId);
    if (idx !== -1) {
      this.data[idx] = { ...this.data[idx], ...person };
    }

    try {
      const res = await fetch(`/api/people/${encodeURIComponent(this.editingPersonId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: this.cleanPersonForSave(person), updated_by: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      this.updateAutoSaveBadge("saved");
      this.updateSyncBadge("live");
    } catch (error) {
      console.error("Auto-save failed:", error);
      this.updateAutoSaveBadge("error");
      this.updateSyncBadge("offline");
    }
  },

  readProfileForm(existing = {}) {
    const value = (id) => this.cleanProfileText(document.getElementById(id)?.value);
    const spouseIds = Array.isArray(this.editingSpouses) && this.editingSpouses.length > 0
      ? this.editingSpouses
      : value("editSpouses").split(",").map((id) => id.trim()).filter(Boolean);
    const childIds = Array.isArray(this.editingChildren) && this.editingChildren.length > 0
      ? this.editingChildren
      : value("editChildren").split(",").map((id) => id.trim()).filter(Boolean);

    return {
      ...existing,
      name: value("editName"),
      nickname: value("editNickname") || existing.nickname || "",
      age: parseInt(document.getElementById("editAge")?.value, 10) || 0,
      dob: value("editDob"),
      gender: document.getElementById("editGender")?.value || "male",
      city: value("editCity"),
      bio: value("editBio"),
      familyLabel: value("editFamilyLabel") || existing.familyLabel || "Other",
      generation: parseInt(document.getElementById("editGeneration")?.value, 10) || 3,
      branch: document.getElementById("editBranch")?.value || "immediate",
      familyUnit: value("editFamilyUnit") || "core_ammar",
      fatherId: value("editFatherId") || null,
      motherId: value("editMotherId") || null,
      spouses: spouseIds.map((id) => ({ id, status: "married" })),
      children: childIds,
      isInLaw: Boolean(document.getElementById("editIsInLaw")?.checked),
      avatar: (this.currentAvatarBase64 !== null && this.currentAvatarBase64 !== undefined) ? this.currentAvatarBase64 : (existing.avatar || ""),
    };
  },

  async saveProfile() {
    if (this.isSaving) return;
    const creating = this.isCreating;
    const existing = creating ? {} : this.getPerson(this.editingPersonId);
    if (!existing && !creating) return;
    const person = this.readProfileForm(existing || {});
    if (!person.name) {
      this.showToast("Name Required", "Enter the member's full name before saving.", "warn");
      return;
    }

    if (creating) {
      person.id = `member_${Date.now().toString(36)}`;
      this.data.push(person);
    } else {
      const id = this.editingPersonId;
      person.id = id;
      const idx = this.data.findIndex((p) => p.id === id);
      if (idx !== -1) {
        this.data[idx] = { ...this.data[idx], ...person };
      }
    }

    // Reciprocal relationships in memory:
    // 1. Spouses link
    const spouseIds = (person.spouses || []).map((s) => (typeof s === "string" ? s : s.id));
    spouseIds.forEach((spId) => {
      const spouseObj = this.getPerson(spId);
      if (spouseObj) {
        if (!Array.isArray(spouseObj.spouses)) spouseObj.spouses = [];
        if (!spouseObj.spouses.some((s) => (typeof s === "string" ? s : s.id) === person.id)) {
          spouseObj.spouses.push({ id: person.id, status: "married" });
        }
      }
    });

    // 2. Children link
    const childIds = Array.isArray(person.children) ? person.children : [];
    childIds.forEach((chId) => {
      const childObj = this.getPerson(chId);
      if (childObj) {
        if (person.gender === "female") {
          childObj.motherId = person.id;
        } else {
          childObj.fatherId = person.id;
        }
      }
    });

    // 3. Parents link
    if (person.fatherId) {
      const fatherObj = this.getPerson(person.fatherId);
      if (fatherObj) {
        if (!Array.isArray(fatherObj.children)) fatherObj.children = [];
        if (!fatherObj.children.includes(person.id)) fatherObj.children.push(person.id);
      }
    }
    if (person.motherId) {
      const motherObj = this.getPerson(person.motherId);
      if (motherObj) {
        if (!Array.isArray(motherObj.children)) motherObj.children = [];
        if (!motherObj.children.includes(person.id)) motherObj.children.push(person.id);
      }
    }

    this.isSaving = true;
    this.updateAutoSaveBadge("saving");
    this.updateSyncBadge("saving");
    try {
      if (creating) {
        const res = await fetch("/api/people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: person.id, data: this.cleanPersonForSave(person), updated_by: null }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const id = this.editingPersonId;
        const res = await fetch(`/api/people/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: this.cleanPersonForSave(person), updated_by: null }),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      await this.fetchData();
    } catch (error) {
      console.warn("Backend API save error (using updated in-memory state):", error);
      this.updateAutoSaveBadge("saved");
      this.updateSyncBadge("preview");
    } finally {
      this.isSaving = false;
      this.populateCityFilter();
      this.updateAutoSaveBadge("saved");
      this.closeEditModal();
      this.applyFilters();
      this.render();
      this.showToast(creating ? "Member Added" : "Profile Saved", `${person.name} is now saved.`, "success");
    }
  },

  async deletePerson() {
    const id = this.editingPersonId;
    const person = this.getPerson(id);
    if (!person || this.isSaving) return;
    if (!window.confirm(`Delete ${person.name} from the shared family database? This cannot be undone.`)) return;

    this.isSaving = true;
    this.updateSyncBadge("saving");
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());

      const relatedUpdates = this.data.filter((item) => item.id !== id).map((item) => {
        const changed = item.fatherId === id || item.motherId === id ||
          (item.children || []).includes(id) || (item.spouses || []).some((spouse) => spouse.id === id);
        if (!changed) return Promise.resolve();
        const updated = {
          ...item,
          fatherId: item.fatherId === id ? null : item.fatherId,
          motherId: item.motherId === id ? null : item.motherId,
          children: (item.children || []).filter((childId) => childId !== id),
          spouses: (item.spouses || []).filter((spouse) => spouse.id !== id),
        };
        return fetch(`/api/people/${encodeURIComponent(item.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: this.cleanPersonForSave(updated) }),
        }).then((response) => {
          if (!response.ok) throw new Error(`Relationship cleanup failed for ${item.id}`);
        });
      });
      await Promise.all(relatedUpdates);
      await this.fetchData();
      this.closeEditModal();
      this.applyFilters();
      this.render();
      this.showToast("Member Deleted", `${person.name} was removed from the shared archive.`, "success");
    } catch (error) {
      console.error("Supabase delete failed:", error);
      this.updateSyncBadge("offline");
      this.showToast("Delete Failed", "The database rejected deletion. Check the latest CRUD setup and try again.", "warn");
    } finally {
      this.isSaving = false;
    }
  },

  updateAutoSaveBadge(state) {
    const badge = document.getElementById("editAutoSavePill");
    if (!badge) return;

    if (state === "saving") {
      badge.className = "autosave-pill saving";
      badge.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> <span>Saving...</span>`;
    } else if (state === "saved") {
      badge.className = "autosave-pill saved";
      badge.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>Saved</span>`;
    } else if (state === "error") {
      badge.className = "autosave-pill error";
      badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>Not saved</span>`;
    }
  },

  openEditModal(id) {
    const person = this.getPerson(id);
    if (person) this.showPersonEditor(person, false);
  },

  openCreateModal() {
    this.showPersonEditor({
      name: "", nickname: "", age: 0, dob: "", gender: "male", city: "",
      generation: 3, branch: "immediate", familyUnit: "core_ammar",
      familyLabel: "Other", profession: "", bio: "",
      fatherId: null, motherId: null, spouses: [], children: [],
      isInLaw: false, avatar: "",
    }, true);
  },

  showPersonEditor(person, creating) {
    this.isCreating = creating;
    this.editingPersonId = creating ? null : person.id;
    this.currentAvatarBase64 = person.avatar || null;
    const setValue = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.value = value ?? "";
    };
    setValue("editName", person.name);
    setValue("editAge", person.age);
    setValue("editGender", person.gender || "male");
    setValue("editCity", person.city);
    setValue("editBio", person.bio);
    setValue("editFamilyLabel", person.familyLabel || "Other");
    setValue("editGeneration", person.generation || 3);
    setValue("editBranch", person.branch || "immediate");
    const inLaw = document.getElementById("editIsInLaw");
    if (inLaw) inLaw.checked = Boolean(person.isInLaw);

    // Dynamic Family Unit select dropdown
    const familyUnitSelect = document.getElementById("editFamilyUnit");
    if (familyUnitSelect) {
      const baseUnits = [
        { id: "core_ammar", label: "Ammar Immediate Family (Keluarga Ammar)" },
        { id: "p_isa_root", label: "Isa & Zaharah Root (Datuk Sebelah Ayah)" },
        { id: "m_zain_root", label: "Zain & Noraini Root (Datuk Sebelah Ibu)" },
        { id: "d_paklong", label: "Keluarga Paklong (Kuantan)" },
        { id: "d_pakngah", label: "Keluarga Pakngah (Ipoh)" },
        { id: "d_makteh", label: "Keluarga Makteh (Shah Alam)" },
        { id: "d_aciknora", label: "Keluarga Acik Nora (Bangi)" },
        { id: "d_maksulaili", label: "Keluarga Maksu Laili (Subang)" },
        { id: "m_zainal", label: "Keluarga Zainal (Gombak)" },
        { id: "m_azhar", label: "Keluarga Azhar (Melaka)" },
        { id: "m_mazri", label: "Keluarga Mazri (Ampang)" },
        { id: "m_yusma", label: "Keluarga Yusma (Seremban)" }
      ];
      const knownIds = new Set(baseUnits.map((u) => u.id));
      this.data.forEach((p) => {
        if (p.familyUnit && !knownIds.has(p.familyUnit)) {
          knownIds.add(p.familyUnit);
          baseUnits.push({ id: p.familyUnit, label: p.familyLabel || p.familyUnit });
        }
      });
      familyUnitSelect.innerHTML = baseUnits
        .map((u) => `<option value="${u.id}">${u.label}</option>`)
        .join("");
      familyUnitSelect.value = person.familyUnit || "core_ammar";

      familyUnitSelect.onchange = () => {
        const selectedOpt = familyUnitSelect.options[familyUnitSelect.selectedIndex];
        const labelText = selectedOpt ? selectedOpt.text.split("(")[0].trim() : "Other";
        const labelInput = document.getElementById("editFamilyLabel");
        if (labelInput) labelInput.value = labelText;
        this.triggerAutoSave(true);
      };
    }

    // Dynamic Spouses dropdown + interactive chips
    this.editingSpouses = (person.spouses || []).map((s) => (typeof s === "string" ? s : s.id)).filter(Boolean);
    const renderSpouseChips = () => {
      const container = document.getElementById("selectedSpousesContainer");
      setValue("editSpouses", this.editingSpouses.join(", "));
      if (!container) return;
      if (this.editingSpouses.length === 0) {
        container.innerHTML = `<span style="font-size:11px; color:#94a3b8; font-style:italic;">No spouse selected</span>`;
        return;
      }
      container.innerHTML = this.editingSpouses.map((sId) => {
        const sp = this.getPerson(sId);
        const name = sp ? sp.name : sId;
        const initials = sp ? this.getCleanInitials(sp) : "?";
        const avatarHtml = sp && sp.avatar
          ? `<img src="${sp.avatar}" alt="${name}" />`
          : initials;
        return `
          <div class="relation-chip" data-chip-id="${sId}">
            <span class="chip-avatar ${sp ? sp.gender : "male"}">${avatarHtml}</span>
            <span>${name}</span>
            <button type="button" class="btn-remove-chip" data-remove-spouse="${sId}" title="Remove spouse">&times;</button>
          </div>
        `;
      }).join("");

      container.querySelectorAll("[data-remove-spouse]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetId = btn.dataset.removeSpouse;
          this.editingSpouses = this.editingSpouses.filter((id) => id !== targetId);
          renderSpouseChips();
          populateSpouseOptions();
          this.triggerAutoSave(true);
        });
      });
    };

    const populateSpouseOptions = () => {
      const select = document.getElementById("editSpouseSelect");
      if (!select) return;
      select.innerHTML = `<option value="">+ Select a spouse to add...</option>`;
      this.data
        .filter((item) => item.id !== (creating ? null : person.id) && !this.editingSpouses.includes(item.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((item) => {
          select.add(new Option(`${item.name} (${item.nickname || item.id})`, item.id));
        });
    };

    const spouseSelect = document.getElementById("editSpouseSelect");
    if (spouseSelect) {
      spouseSelect.onchange = (e) => {
        const val = e.target.value;
        if (val && !this.editingSpouses.includes(val)) {
          this.editingSpouses.push(val);
          renderSpouseChips();
          populateSpouseOptions();
          this.triggerAutoSave(true);
        }
        e.target.value = "";
      };
    }
    renderSpouseChips();
    populateSpouseOptions();

    // Dynamic Children dropdown + interactive chips
    this.editingChildren = Array.isArray(person.children) ? [...person.children] : [];
    const renderChildChips = () => {
      const container = document.getElementById("selectedChildrenContainer");
      setValue("editChildren", this.editingChildren.join(", "));
      if (!container) return;
      if (this.editingChildren.length === 0) {
        container.innerHTML = `<span style="font-size:11px; color:#94a3b8; font-style:italic;">No children selected</span>`;
        return;
      }
      container.innerHTML = this.editingChildren.map((cId) => {
        const ch = this.getPerson(cId);
        const name = ch ? ch.name : cId;
        const initials = ch ? this.getCleanInitials(ch) : "?";
        const avatarHtml = ch && ch.avatar
          ? `<img src="${ch.avatar}" alt="${name}" />`
          : initials;
        return `
          <div class="relation-chip" data-chip-id="${cId}">
            <span class="chip-avatar ${ch ? ch.gender : "male"}">${avatarHtml}</span>
            <span>${name}</span>
            <button type="button" class="btn-remove-chip" data-remove-child="${cId}" title="Remove child">&times;</button>
          </div>
        `;
      }).join("");

      container.querySelectorAll("[data-remove-child]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetId = btn.dataset.removeChild;
          this.editingChildren = this.editingChildren.filter((id) => id !== targetId);
          renderChildChips();
          populateChildOptions();
          this.triggerAutoSave(true);
        });
      });
    };

    const populateChildOptions = () => {
      const select = document.getElementById("editChildSelect");
      if (!select) return;
      select.innerHTML = `<option value="">+ Select a child to add...</option>`;
      this.data
        .filter((item) => item.id !== (creating ? null : person.id) && !this.editingChildren.includes(item.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((item) => {
          select.add(new Option(`${item.name} (${item.nickname || item.id})`, item.id));
        });
    };

    const childSelect = document.getElementById("editChildSelect");
    if (childSelect) {
      childSelect.onchange = (e) => {
        const val = e.target.value;
        if (val && !this.editingChildren.includes(val)) {
          this.editingChildren.push(val);
          renderChildChips();
          populateChildOptions();
          this.triggerAutoSave(true);
        }
        e.target.value = "";
      };
    }
    renderChildChips();
    populateChildOptions();

    ["editFatherId", "editMotherId"].forEach((selectId) => {
      const select = document.getElementById(selectId);
      if (!select) return;
      const first = select.options[0];
      select.replaceChildren(first);
      this.data.filter((item) => item.id !== person.id).sort((a, b) => a.name.localeCompare(b.name)).forEach((item) => {
        select.add(new Option(`${item.name} (${item.id})`, item.id));
      });
    });
    setValue("editFatherId", person.fatherId);
    setValue("editMotherId", person.motherId);

    document.querySelectorAll(".gender-pill-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.gender === (person.gender || "male"));
    });
    const ageDisplay = document.getElementById("ageAutoDisplay");
    if (ageDisplay) ageDisplay.innerHTML = `Age <b>${person.age || 0}</b>y`;

    let isoDate = "";
    if (person.dob && /^\d{4}-\d{2}-\d{2}$/.test(person.dob)) {
      isoDate = person.dob;
    } else if (person.dob) {
      const parts = person.dob.split("-");
      if (parts.length === 3) {
        const month = this.monthsList.indexOf(parts[1].toUpperCase()) + 1;
        if (month) isoDate = `${parts[2]}-${String(month).padStart(2, "0")}-${String(parseInt(parts[0], 10)).padStart(2, "0")}`;
      }
    }
    setValue("editDobPicker", isoDate);
    setValue("editDob", person.dob);
    const dobBadge = document.getElementById("dobFormattedBadge");
    if (dobBadge) dobBadge.textContent = person.dob || "Not set";

    const avatarPreview = document.getElementById("editAvatarPreview");
    const avatarInitials = document.getElementById("editAvatarInitials");
    const removeBtn = document.getElementById("btnRemoveAvatar");
    const fileInput = document.getElementById("editAvatarInput");
    if (fileInput) fileInput.value = "";
    if (avatarInitials) {
      avatarInitials.textContent = this.getCleanInitials(person);
      avatarInitials.style.display = person.avatar ? "none" : "block";
    }
    if (avatarPreview) {
      avatarPreview.src = person.avatar || "";
      avatarPreview.style.display = person.avatar ? "block" : "none";
    }
    if (removeBtn) removeBtn.style.display = person.avatar ? "inline-block" : "none";
    const photoNotice = document.getElementById("photoNotice");
    if (photoNotice) photoNotice.style.display = "none";
    const deleteBtn = document.getElementById("btnDeletePerson");
    if (deleteBtn) deleteBtn.style.display = creating ? "none" : "inline-flex";

    const title = document.getElementById("editModalTitle");
    if (title) title.textContent = creating ? "Add Family Member" : `Edit Profile: ${person.name}`;
    this.updateAutoSaveBadge("saved");
    const modal = document.getElementById("editPersonModal");
    if (modal) {
      modal.classList.add("open");
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
    }
  },

  closeEditModal() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    const modal = document.getElementById("editPersonModal");
    if (modal) {
      modal.classList.remove("open");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
    this.editingPersonId = null;
    this.currentAvatarBase64 = null;
    this.editingSpouses = [];
    this.editingChildren = [];
    this.isCreating = false;
    this.applyFilters();
  },
};

document.addEventListener("DOMContentLoaded", () => {
  FamilyApp.init();
});
