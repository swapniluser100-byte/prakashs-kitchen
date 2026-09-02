document.getElementById('year').textContent = new Date().getFullYear();

  // Google Apps Script Web app URL — used for both contact messages and orders
  const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzkixZjFua-IlFbYnPb1m4wlTrrBljN7W0vLJk9uj30Q2D-mBzNSL715DbtNOzYpA90LA/exec';

  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // ===== Menu ordering (cart) =====
  const cart = {}; // { itemName: { price, qty } }

  document.querySelectorAll('.menu-item[data-price]').forEach(item => {
    const name = item.dataset.name;
    const price = Number(item.dataset.price);
    const qtyEl = item.querySelector('.qty-value');
    const minusBtn = item.querySelector('.qty-minus');
    const plusBtn = item.querySelector('.qty-plus');

    plusBtn.addEventListener('click', () => {
      const qty = (cart[name]?.qty || 0) + 1;
      cart[name] = { price, qty };
      qtyEl.textContent = qty;
      updateOrderSummary();
    });

    minusBtn.addEventListener('click', () => {
      const qty = Math.max(0, (cart[name]?.qty || 0) - 1);
      if (qty === 0) delete cart[name];
      else cart[name] = { price, qty };
      qtyEl.textContent = qty;
      updateOrderSummary();
    });
  });

  function cartTotal(){
    return Object.values(cart).reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  function cartItemCount(){
    return Object.values(cart).reduce((sum, i) => sum + i.qty, 0);
  }

  function cartNoteText(){
    return Object.entries(cart).map(([name, i]) => `${i.qty}x ${name}`).join(', ');
  }

  function updateOrderSummary(){
    const count = cartItemCount();
    const total = cartTotal();
    const countEl = document.getElementById('orderCount');
    const totalEl = document.getElementById('orderTotal');
    const proceedBtn = document.getElementById('proceedToPay');

    if (count === 0){
      countEl.textContent = 'No items selected';
      totalEl.textContent = '';
      proceedBtn.disabled = true;
    } else {
      countEl.textContent = count + (count === 1 ? ' item selected' : ' items selected');
      totalEl.textContent = '₹' + total;
      proceedBtn.disabled = false;
    }
  }

  function logOrderToSheet(note, total, address){
    const formData = new FormData();
    formData.append('type', 'order');
    formData.append('items', note);
    formData.append('total', total);
    formData.append('address', address);
    fetch(FORM_ENDPOINT, { method: 'POST', mode: 'no-cors', body: formData }).catch(() => {});
  }

  document.getElementById('proceedToPay').addEventListener('click', () => {
    const total = cartTotal();
    const note = cartNoteText();
    const addressInput = document.getElementById('deliveryAddress');
    const address = addressInput.value.trim();

    if (!address){
      alert('Please enter a delivery address before proceeding.');
      addressInput.focus();
      return;
    }

    logOrderToSheet(note, total, address);

    if (total === 0){
      alert('Order noted — no payment needed for free items. We\'ll have it ready for you!');
      Object.keys(cart).forEach(name => delete cart[name]);
      document.querySelectorAll('.qty-value').forEach(el => el.textContent = '0');
      addressInput.value = '';
      updateOrderSummary();
      return;
    }

    document.getElementById('upiAmount').value = total;
    document.getElementById('upiNote').value = note;

    const recap = document.getElementById('orderRecap');
    const recapList = document.getElementById('orderRecapList');
    recapList.innerHTML = '';
    Object.entries(cart).forEach(([name, i]) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${i.qty}x ${name}</span><span>₹${i.price * i.qty}</span>`;
      recapList.appendChild(li);
    });
    document.getElementById('orderRecapAddress').textContent = 'Deliver to: ' + address;
    recap.hidden = false;

    updateQr();
    document.getElementById('pay').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ===== UPI Payment =====
  const UPI_ID = 'swapnilbarad9-1@okaxis';
  const PAYEE_NAME = "Prakash's Kitchen";

  function buildUpiLink(amount, note){
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: PAYEE_NAME,
      cu: 'INR'
    });
    if (amount) params.set('am', amount);
    if (note) params.set('tn', note);
    return 'upi://pay?' + params.toString();
  }

  function updateQr(){
    const amount = document.getElementById('upiAmount').value;
    const note = document.getElementById('upiNote').value;
    const link = buildUpiLink(amount, note);
    const qrImg = document.getElementById('upiQr');
    qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(link);
  }

  document.getElementById('upiAmount').addEventListener('input', updateQr);
  document.getElementById('upiNote').addEventListener('input', updateQr);
  updateQr(); // initial QR on page load

  document.getElementById('upiPayBtn').addEventListener('click', function(){
    const amount = document.getElementById('upiAmount').value;
    if (!amount || Number(amount) <= 0){
      alert('Please enter an amount to pay.');
      return;
    }
    const note = document.getElementById('upiNote').value;
    window.location.href = buildUpiLink(amount, note);
  });

  // ===== Contact form =====
  document.getElementById('contactForm').addEventListener('submit', function(e){
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    formData.append('type', 'contact');

    if (FORM_ENDPOINT.includes('PASTE_YOUR')) {
      alert('Form endpoint not set up yet. See DEPLOY-GUIDE.md to connect Google Sheets + email.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    fetch(FORM_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      body: formData
    })
    .then(() => {
      submitBtn.textContent = 'Message sent';
      form.reset();
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send message';
      }, 3000);
    })
    .catch(() => {
      alert('Something went wrong. Please try again or call us directly.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send message';
    });
  });
