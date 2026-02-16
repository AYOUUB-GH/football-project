const fields = [
    { id: 1, name: "ملعب النخبة", city: "الجزائر العاصمة", price: 2000, img: "⚽" },
    { id: 2, name: "كامب نو السلام", city: "وهران", price: 1800, img: "🏆" },
    { id: 3, name: "ساحة الأبطال", city: "قسنطينة", price: 2200, img: "🌟" },
    { id: 4, name: "ملعب الجوهرة", city: "سطيف", price: 1900, img: "💎" },
    { id: 5, name: "أرينا عنابة", city: "عنابة", price: 2100, img: "🔥" },
    { id: 6, name: "تيكنو فيلد", city: "تلمسان", price: 1700, img: "🛡️" }
];

let selectedField = null;
const container = document.getElementById("fieldsContainer");

// وظيفة رسم البطاقات في الصفحة
function renderFields(data) {
    container.innerHTML = "";
    data.forEach(field => {
        const card = document.createElement("div");
        card.className = "field-card";
        card.innerHTML = `
            <div style="height: 150px; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 4rem;">
                ${field.img}
            </div>
            <div class="field-info">
                <h3>${field.name}</h3>
                <p><i class="fas fa-map-marker-alt"></i> ${field.city}</p>
                <span class="price-tag">${field.price} دج <small>/ ساعة</small></span>
                <button class="btn-book" onclick="openModal(${field.id})">احجز الآن</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function openModal(id) {
    selectedField = fields.find(f => f.id === id);
    document.getElementById("modalTitle").innerText = `حجز في ${selectedField.name}`;
    document.getElementById("bookingModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("bookingModal").style.display = "none";
}

function confirmBooking() {
    const date = document.getElementById("bookingDate").value;
    if(!date) return alert("الرجاء اختيار التاريخ");
    
    alert(`تم إرسال طلب حجز لـ ${selectedField.name} بنجاح! ✅`);
    closeModal();
}

// خاصية البحث السريع
document.getElementById("searchInput").addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = fields.filter(f => 
        f.name.toLowerCase().includes(term) || f.city.toLowerCase().includes(term)
    );
    renderFields(filtered);
});

// التشغيل الأولي
renderFields(fields);