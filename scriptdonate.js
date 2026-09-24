function showNotification(message, isError = false) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#e74c3c' : '#27ae60';
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 5000);
}

// Preset button amounts
const mpesaButtons = document.querySelectorAll('.amount-btn-mpesa');
const mpesaAmountInput = document.getElementById('customMpesaAmount');

mpesaButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        mpesaButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (mpesaAmountInput) {
            mpesaAmountInput.value = btn.dataset.amount;
        }
    });
});

// Trigger STK Push execution
const mpesaBtn = document.getElementById('mpesaBtn');

if (mpesaBtn) {
    mpesaBtn.addEventListener('click', async () => {
        const amount = Number(mpesaAmountInput?.value);
        const phone = document.getElementById('mpesaPhoneNumber')?.value.trim();

        if (!Number.isInteger(amount) || amount < 10) {
            showNotification('Please enter a valid amount of at least KES 10.', true);
            return;
        }

        if (!phone) {
            showNotification('Please enter a valid M-Pesa phone number.', true);
            return;
        }

        mpesaBtn.disabled = true;
        mpesaBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing STK Push...';

        try {
            const response = await fetch('/api/mpesa/stkpush', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount, phone })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to trigger M-Pesa request.');
            }

            showNotification(data.message || 'STK Push sent! Please enter your M-Pesa PIN.');
        } catch (error) {
            console.error('Front-end request error:', error);
            showNotification(error.message || 'Payment initiation failed.', true);
        } finally {
            mpesaBtn.disabled = false;
            mpesaBtn.innerHTML = '<i class="fas fa-mobile-alt"></i> Donate via M-Pesa';
        }
    });
}
