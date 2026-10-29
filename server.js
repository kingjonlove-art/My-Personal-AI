    let recognition = null;
    let isListening = false;
    let userWantedMicOn = false;

    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        
        // 'en-US' বা 'bn-BD' এর পরিবর্তে 'auto' বা ফাঁকা রাখা যায় অথবা ব্রাউজারের ডিফল্ট মাল্টিলিঙ্গুয়াল ধরতে 'en-US' বা 'bn-BD' টগল করা যায়। 
        // নিচে 'en-US' সেট করে দিলে ইংলিশ খুব ভালো ক্যাচ করবে, তবে বাংলাও বলা যায়। অথবা আপনি চাইলে 'bn-BD' রাখতে পারেন।
        recognition.lang = 'en-US'; 

        recognition.onstart = () => {
            isListening = true;
            micBtn.classList.add('active');
            micBtn.textContent = "MIC ON";
            sysStatus.textContent = "VOICE READY";
            sysStatus.className = "live active";
            listenPill.textContent = "AUTO-LISTEN ON";
        };

        recognition.onresult = (event) => {
            if (isSpeaking) return;
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            if (transcript && transcript !== lastSentText) {
                userInput.value = transcript;
                handleSendMessage(transcript);
            }
        };

        recognition.onend = () => {
            isListening = false;
            micBtn.classList.remove('active');
            micBtn.textContent = "MIC OFF";
            sysStatus.textContent = "VOICE OFF";
            sysStatus.className = "live";
            listenPill.textContent = "MIC OFF";
            
            if (userWantedMicOn && !isSpeaking) {
                setTimeout(() => {
                    try { recognition.start(); } catch(e) {}
                }, 800);
            }
        };

        recognition.onerror = (event) => {
            console.log("Speech Error: ", event.error);
        };
    }
