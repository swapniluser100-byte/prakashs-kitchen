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
  let pendingOrder = { note: '', total: 0 }; // snapshot taken when "Proceed to pay" is clicked

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

  function resetOrderUI(){
    Object.keys(cart).forEach(name => delete cart[name]);
    document.querySelectorAll('.qty-value').forEach(el => el.textContent = '0');
    document.getElementById('deliveryAddress').value = '';
    document.getElementById('orderRecap').hidden = true;
    document.getElementById('confirmPaidBtn').hidden = true;
    document.getElementById('confirmHint').hidden = true;
    updateOrderSummary();
  }

  document.getElementById('proceedToPay').addEventListener('click', () => {
    const total = cartTotal();
    const note = cartNoteText();
    pendingOrder = { note, total };

    const recap = document.getElementById('orderRecap');
    const recapList = document.getElementById('orderRecapList');
    recapList.innerHTML = '';
    Object.entries(cart).forEach(([name, i]) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${i.qty}x ${name}</span><span>₹${i.price * i.qty}</span>`;
      recapList.appendChild(li);
    });
    recap.hidden = false;

    // Reset confirmation state from any previous order
    document.getElementById('confirmPaidBtn').hidden = true;
    document.getElementById('confirmHint').hidden = true;

    if (total === 0){
      document.getElementById('paidFlow').hidden = true;
      document.getElementById('payQrBox').hidden = true;
      document.getElementById('freeFlow').hidden = false;
    } else {
      document.getElementById('paidFlow').hidden = false;
      document.getElementById('payQrBox').hidden = false;
      document.getElementById('freeFlow').hidden = true;
      document.getElementById('upiAmount').value = total;
      document.getElementById('upiNote').value = note;
      updateQr();
    }

    document.getElementById('pay').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function getValidatedAddress(){
    const addressInput = document.getElementById('deliveryAddress');
    const address = addressInput.value.trim();
    if (!address){
      alert('Please enter a delivery address — it\'s required to complete your order.');
      addressInput.focus();
      return null;
    }
    return address;
  }

  function logOrderToSheet(note, total, address, status){
    const formData = new FormData();
    formData.append('type', 'order');
    formData.append('items', note);
    formData.append('total', total);
    formData.append('address', address);
    formData.append('status', status);
    fetch(FORM_ENDPOINT, { method: 'POST', mode: 'no-cors', body: formData }).catch(() => {});
  }

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

  // Step 1: customer taps "Pay with UPI app" — opens their UPI app, but nothing is
  // logged yet. No entry is created until they confirm the payment actually happened.
  document.getElementById('upiPayBtn').addEventListener('click', function(){
    const amount = document.getElementById('upiAmount').value;
    if (!amount || Number(amount) <= 0){
      alert('Please enter an amount to pay.');
      return;
    }
    if (!getValidatedAddress()) return;

    const note = document.getElementById('upiNote').value;
    window.location.href = buildUpiLink(amount, note);

    // Reveal the confirmation step once they've been sent to pay
    document.getElementById('confirmPaidBtn').hidden = false;
    document.getElementById('confirmHint').hidden = false;
  });

  // Step 2: customer confirms the payment actually went through — THIS is what
  // creates the Sheet entry and triggers the email, not the "Pay" click above.
  document.getElementById('confirmPaidBtn').addEventListener('click', function(){
    const address = getValidatedAddress();
    if (!address) return;

    const amount = document.getElementById('upiAmount').value || pendingOrder.total;
    const note = document.getElementById('upiNote').value || pendingOrder.note;

    logOrderToSheet(note, amount, address, 'Paid (confirmed by customer)');
    alert('Thank you! Your order has been confirmed and sent to us.');
    resetOrderUI();
  });

  // Free items: no payment step needed, but address is still required before
  // the order is logged.
  document.getElementById('confirmFreeBtn').addEventListener('click', function(){
    const address = getValidatedAddress();
    if (!address) return;

    logOrderToSheet(pendingOrder.note, 0, address, 'Free (confirmed)');
    alert('Thank you! Your free order has been confirmed and sent to us.');
    resetOrderUI();
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
