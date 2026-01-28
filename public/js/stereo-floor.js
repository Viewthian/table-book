const floor = document.getElementById("stereo-floor");
const datePicker = document.getElementById("datePicker");
const confirmBtn = document.getElementById("confirm");
const tooltip = document.getElementById("tooltip");
const timePicker = document.getElementById("timePicker");


const selectedTables = new Set();
let reservedInfo = {};
// let staticElements = [];


console.log("stereo floor:", floor);
console.log("staticElements:", staticElements);
console.log("tables:", tables);

/* -------------------- LOAD AVAILABILITY (DATE ONLY) -------------------- */

async function loadAvailability(date) {
  const res = await fetch(`/stereo-availability?date=${date}`);
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
          <strong>Time:</strong> ${reservedMap[t.id].bookingTime}
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


/* -------------------- CONFIRM BOOKING -------------------- */

confirmBtn.onclick = async () => {
  try {
    const name = document.getElementById("name").value.trim();
    const bookingTime = document.getElementById("timePicker").value;
    const amount = Number(document.getElementById("amount").value);
    const remark = document.getElementById("remark").value;
    const date = datePicker.value;
    const phoneInput = document.getElementById("phone");
    const phone = phoneInput.value.trim();

    const phoneRegex = /^(0\d{9}|\+66\d{9})$/;

    if (!name || !phone || !bookingTime || !amount || selectedTables.size === 0) {
      showErrorModal("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (!phoneRegex.test(phone)) {
      showErrorModal("กรุณากรอกเบอร์โทรถูกต้อง ตัวอย่างเบอร์โทร: 0812345678");
      phoneInput.focus();
      return;
    }

    // ✅ combine date + time → ISO datetime
    const bookingDateTime = new Date(`${date}T${bookingTime}:00`);

    if (isNaN(bookingDateTime.getTime())) {
      showErrorModal("วันที่และเวลาไม่ถูกต้อง");
      return;
    }

    // 🔒 disable button while submitting
    confirmBtn.disabled = true;
    confirmBtn.innerText = "Saving...";

    const res = await fetch("/reserve-stereo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        bookingDateTime,
        amount,
        remark,
        tables: [...selectedTables]
      })
    });

    let data = {};
    try {
      data = await res.json();   // prevent crash if backend fails
    } catch (e) {}

    if (!res.ok) {
      showErrorModal(data.error || "การจองผิดผลาด กรุณาลองใหม่อีกครั้ง");
      confirmBtn.disabled = false;
      confirmBtn.innerText = "Confirm";
      return;
    }

    // ✅ success
    showSuccessModal(); // inside this you can auto-reload after 2s

  } catch (err) {
    console.error(err);
    showErrorModal("Network error. กรุณาลองใหม่อีกครั้ง");
    confirmBtn.disabled = false;
    confirmBtn.innerText = "Confirm";
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



