const floor = document.getElementById("edit-viewbar-floor");
const datePicker = document.getElementById("datePicker");
const confirmBtn = document.getElementById("confirm");
const tooltip = document.getElementById("tooltip");
const timePicker = document.getElementById("timePicker");
const slipInput = document.getElementById("slip");

const imageModal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");
const closeModal = document.querySelector(".close-modal");


const selectedTables = new Set(window.existingTables || []);
let reservedInfo = {};

/* -------------------- LOAD AVAILABILITY (DATE ONLY) -------------------- */

async function loadAvailability(date) {
  const res = await fetch(`/availability?date=${date}`);
  const data = await res.json();

  reservedInfo = data.reservedMap || {};

  floor.innerHTML = "";
  renderStaticElements(staticElements);
  renderTables(reservedInfo);
}

/* -------------------- RENDER FLOOR -------------------- */
function renderStaticElements(elements) {
  console.log("Rendering static elements:", elements);


  elements.forEach(el => {
    const div = document.createElement("div");
    div.className = el.className;
    div.innerText = el.label;
    div.style.left = el.left;
    div.style.top = el.top;
    div.style.width = el.width;
    div.style.height = el.height;

    floor.appendChild(div);
    // div.style.outline = "3px solid red";
  });
}

function renderTables(reservedMap = {}) {
  tables.forEach(t => {
    const div = document.createElement("div");
    div.className = `table ${t.type}`;

    div.style.left = `${t.x}%`;
    div.style.top  = `${t.y}%`;

    const label = document.createElement("span");
    label.innerHTML = t.id.replace("|", "<br>");
    div.appendChild(label);

    if (t.rotate) {
      div.style.transform = `rotate(${t.rotate}deg)`;
    }

    const isOwn = selectedTables.has(t.id);
    const reservedByOther = reservedMap[t.id] && !isOwn;

    /* 🔴 RESERVED BY OTHERS (LOCKED) */
    if (reservedByOther) {
      div.classList.add("reserved");
      div.style.cursor = "not-allowed";
      floor.appendChild(div);
      return;
    }

    /* 🟢 OWN TABLE (PRESELECTED & EDITABLE) */
    if (isOwn) {
      div.classList.add("own", "selected");
    }

    /* 🟢 CLICK TO SELECT / UNSELECT */
    div.addEventListener("click", () => {
      if (selectedTables.has(t.id)) {
        selectedTables.delete(t.id);
        div.classList.remove("selected");
      } else {
        selectedTables.add(t.id);
        div.classList.add("selected");
      }
    });

    floor.appendChild(div);
  });
}




/* -------------------- INITIAL LOAD -------------------- */

window.addEventListener("DOMContentLoaded", () => {
  generateTimeSlots();

  if (window.existingTime) {
    timePicker.value = window.existingTime;
  }

  if (datePicker.value) {
    loadAvailability(datePicker.value);
  }
});


datePicker.addEventListener("change", e => {
  loadAvailability(e.target.value);
});

/* -------------------- TIME SLOT -------------------- */

function generateTimeSlots() {
  const startHour = 10;
  const endHour = 22;

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let min of [0, 30]) {
      if (hour === endHour && min > 0) break;

      const hh = hour.toString().padStart(2, "0");
      const mm = min.toString().padStart(2, "0");
      const time = `${hh}:${mm}`;

      const option = document.createElement("option");
      option.value = time;
      option.textContent = time;
      timePicker.appendChild(option);
    }
  }
}

// generate once on page load
generateTimeSlots();

slipInput.addEventListener("change", () => {

  previewContainer.innerHTML = "";

  const files = slipInput.files;

  // ✅ LIMIT MAX 5 IMAGES
  if (files.length > 5) {

    showErrorModal("อัปโหลดรูปได้สูงสุด 5 รูป");

    slipInput.value = "";

    return;
  }

  Array.from(files).forEach(file => {

    if (
      !["image/jpeg", "image/png"]
      .includes(file.type)
    ) {
      return;
    }

    const reader = new FileReader();

    reader.onload = e => {

      const img =
        document.createElement("img");

      img.src = e.target.result;

      img.style.width = "120px";
      img.style.height = "120px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      img.style.border = "1px solid #555";
      img.style.cursor = "pointer";

      img.classList.add("clickable-image");

      previewContainer.appendChild(img);
    };

    reader.readAsDataURL(file);

  });

});



//UPDATE
confirmBtn.onclick = async () => {
  const id = document.getElementById("update_id").value;
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const date = document.getElementById("datePicker").value;
  const time = document.getElementById("timePicker").value;
  const amount = Number(document.getElementById("amount").value);
  const transfer = Number(document.getElementById("transfer").value);
  const remark = document.getElementById("remark").value;
  const image = document.getElementById("slip").files[0];

  if (!name || !phone || !date || !time || !amount || selectedTables.size === 0) {
    showErrorModal("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }

  const bookingDateTime = new Date(`${date}T${time}:00`);

  /* ---------------- LOADING START ---------------- */

  confirmBtn.disabled = true;

  const originalText =
    confirmBtn.innerHTML;

  confirmBtn.innerHTML =
    "⏳ Processing...";

  /* ---------------- FORM DATA ---------------- */

  const formData = new FormData();
  formData.append("name", name);
  formData.append("phone", phone);
  formData.append("bookingDateTime", bookingDateTime.toISOString());
  formData.append("amount", amount);
  formData.append("transfer", transfer);
  formData.append("remark", remark);
  formData.append("tables", JSON.stringify([...selectedTables]));

  const files =
    document.getElementById("slip").files;

  Array.from(files).forEach(file => {
    formData.append("image", file);
  });

  try {

    const res = await fetch(`/update-viewbar/${id}`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      showErrorModal(data.error || "แก้ไขไม่สำเร็จ โปรดลองอีกครั้ง");
      return;
    }

    showSuccessModal("แก้ไขการจองสำเร็จ!");
    
    // 👇 SCROLL TO TOP
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    } catch (err) {

    console.error(err);

    showErrorModal(
      "Something went wrong"
    );

  } finally {

    /* ---------------- LOADING END ---------------- */

    confirmBtn.disabled = false;

    confirmBtn.innerHTML =
      originalText;

  }
};



function showErrorModal(message) {
  document.getElementById("errorMessage").innerText = message;
  document.getElementById("errorModal").classList.add("show");
}

function closeErrorModal() {
  document.getElementById("errorModal").classList.remove("show");
}

function showSuccessModal() {
  document.getElementById("successModal").classList.add("show");
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}


closeModal.addEventListener("click", () => {
  imageModal.style.display = "none";
  document.body.style.overflow = "";
});

// Close when clicking outside image
imageModal.addEventListener("click", e => {
  if (e.target === imageModal) {
    imageModal.style.display = "none";
    document.body.style.overflow = "";
  }
});

