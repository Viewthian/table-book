const floor = document.getElementById("view-village-floor");
const datePicker = document.getElementById("datePicker");
const confirmBtn = document.getElementById("confirm");
const tooltip = document.getElementById("tooltip");
const timePicker = document.getElementById("timePicker");
const slipInput = document.getElementById("slip");

const imageModal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");
const closeModal = document.querySelector(".close-modal");


const selectedTables = new Set();
let reservedInfo = {};
// let staticElements = [];

/* -------------------- LOAD AVAILABILITY (DATE ONLY) -------------------- */

async function loadAvailability(date) {
  const res = await fetch(`/view-village-availability?date=${date}`);
  const data = await res.json();

  reservedInfo = data.reservedMap || {};

  floor.innerHTML = "";               // 🔥 clear once
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
  console.log("reservedMap keys:", Object.keys(reservedMap));
  selectedTables.clear();

  tables.forEach(t => {
    const div = document.createElement("div");
    div.className = `table ${t.type}`;

    div.style.left = t.x + "%";
    div.style.top = t.y + "%";

    // ✅ dynamic rotation
    if (t.rotate) {
      div.style.transform = `rotate(${t.rotate}deg)`;
      div.innerHTML = `<span>${t.id}</span>`;
      div.innerHTML = t.id.replace("|", "<br>");
    } else {
      div.innerText = t.id;
    }

    // RESERVED TABLE
    if (reservedMap[t.id]) {
      div.classList.add("reserved");

      div.addEventListener("mouseenter", e => {
        tooltip.innerHTML = `
          <strong>Table:</strong> ${t.id}<br>
          <strong>Name:</strong> ${reservedMap[t.id].name}<br>
          <strong>Phone:</strong> ${reservedMap[t.id].phone}<br>
          <strong>Time:</strong> ${reservedMap[t.id].bookingTime}<br>
          <strong>Note:</strong> ${reservedMap[t.id].remark || "-"}
        `;
        tooltip.style.display = "block";
      });

      div.addEventListener("mousemove", e => {
        const rect = floor.getBoundingClientRect();
        tooltip.style.left = (e.clientX - rect.left + 10) + "px";
        tooltip.style.top  = (e.clientY - rect.top  + 10) + "px";
      });

      div.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });
    }
    // AVAILABLE TABLE
    else {
      div.addEventListener("click", () => {
        div.classList.toggle("selected");

        if (selectedTables.has(t.id)) {
          selectedTables.delete(t.id);
        } else {
          selectedTables.add(t.id);
        }
      });
    }

    floor.appendChild(div);
  });
}




/* -------------------- INITIAL LOAD -------------------- */

window.addEventListener("DOMContentLoaded", () => {
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

const previewContainer =
  document.getElementById("previewContainer");

slipInput.addEventListener("change", () => {

  previewContainer.innerHTML = "";

  const files = slipInput.files;

  // ✅ LIMIT MAX 5 IMAGES
  if (files.length > 5) {

    showErrorModal("อัปโหลดรูปได้สูงสุด 5 รูป");

    slipInput.value = "";

    return;
  }

  if (!files.length) return;

  Array.from(files).forEach(file => {

    // Validate image type
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      alert("Only JPG or PNG allowed");
      return;
    }

    const reader = new FileReader();

    reader.onload = e => {

      const img = document.createElement("img");

      img.src = e.target.result;

      img.style.width = "120px";
      img.style.height = "120px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      img.style.border = "1px solid #555";

      previewContainer.appendChild(img);
    };

    reader.readAsDataURL(file);
  });

});


/* -------------------- CONFIRM BOOKING -------------------- */
confirmBtn.onclick = async () => {

  const name =
    document.getElementById("name")
    .value.trim();

  const phone =
    document.getElementById("phone")
    .value.trim();

  const bookingTime =
    document.getElementById("timePicker")
    .value;

  const amount =
    document.getElementById("amount")
    .value;

  const transfer =
    document.getElementById("transfer")
    .value;

  const remark =
    document.getElementById("remark")
    .value;

  const date = datePicker.value;

  if (
    !name ||
    !phone ||
    !bookingTime ||
    !amount ||
    transfer === "" ||
    selectedTables.size === 0
  ) {

    showErrorModal(
      "กรุณากรอกข้อมูลให้ครบถ้วน"
    );

    return;
  }

  const bookingDateTime =
    new Date(`${date}T${bookingTime}:00`);

  if (
    isNaN(bookingDateTime.getTime())
  ) {

    showErrorModal(
      "Invalid date/time"
    );

    return;
  }

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

  formData.append(
    "bookingDateTime",
    bookingDateTime.toISOString()
  );

  formData.append("amount", amount);

  formData.append("transfer", transfer);

  formData.append("remark", remark);

  formData.append(
    "tables",
    JSON.stringify([...selectedTables])
  );

  Array.from(slipInput.files)
    .forEach(file => {

      formData.append("image", file);

    });

  try {

    const res = await fetch(
      "/reserve-view-village",
      {
        method: "POST",
        body: formData
      }
    );

    const data = await res.json();

    if (!res.ok) {

      showErrorModal(
        data.error ||
        "Reservation failed"
      );

      return;
    }

    showSuccessModal();

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

