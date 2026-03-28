// Lucide icons
lucide.createIcons();

// GSAP Animations
window.addEventListener('DOMContentLoaded', () => {
    gsap.from('.glass-navbar', { y: -64, opacity: 0, duration: 0.8, ease: 'power2.out' });
    gsap.from('.bento-item', {
        y: 48,
        opacity: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: 'power2.out',
        delay: 0.2
    });
});

const el = {
    status: document.getElementById('status'),
    video: document.getElementById('video'),
    apiKey: document.getElementById('apiKey'),
    button: document.getElementById('uploadWidget')
}

const app = {
    transcriptionURL: '',
    public_id: '',
    waitForTranscription: async () => {
        const maxAttempts = 30;
        const delayMs = 2000;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const url = `https://res.cloudinary.com/${config.cloudName}/raw/upload/v${Date.now()}/${app.public_id}.transcript`;
            try {
                const response = await fetch(url, { method: 'GET' });
                if (response.ok) {
                    await response.text();
                    app.transcriptionURL = url;
                    return true;
                }
            } catch (error) {}
            if (attempt < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
        throw new Error('Transcrição não encontrada após 30 tentativas.');
    },
    getTranscription: async () => {
        const response = await fetch(app.transcriptionURL);
        return response.text();
    },
    getViralMoment: async () => {
        const transcription = await app.getTranscription();
        const model = 'gemini-2.5-flash';
        const endpointGemini = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const prompt = `\nRole: You are a professional video editor specializing in viral content.\nTask: Analyze the transcription below and identify the most engaging, funny, or surprising segment.\nConstraints:\n1. Duration: Minimum 30 seconds, Maximum 60 seconds.\n2. Format: Return ONLY the start and end string for Cloudinary. Format: so_<start_seconds>,eo_<end_seconds>\n3. Examples: "so_10,eo_20" or "so_12.5,eo_45.2"\n. CRITICAL: Do not use markdown, do not use quotes, do not explain. Return ONLY the raw string.\n\nTranscription:\n${transcription}`;
        const headers = {
            'x-goog-api-key': el.apiKey.value,
            'Content-Type': 'application/json'
        }
        const contents = [
            {
                parts: [
                    {
                        text: prompt
                    }
                ]
            }
        ]
        const maxAttempts = 3;
        const delay = 1500;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                const response = await fetch(endpointGemini, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ contents })
                });
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`Gemini retornou status ${response.status}: ${text}`);
                }
                const data = await response.json();
                const rawText = data.candidates[0].content.parts[0].text;
                return rawText.replace(/```/g, '').replace(/json/g, "").trim();
            } catch (error) {
                if (attempt >= maxAttempts) {
                    throw new Error(`Falha ao acessar Gemini após ${maxAttempts} tentativas: ${error.message}`);
                }
                const retryDelay = delay * attempt;
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }
    },
}
const config = {
    cloudName: 'djj5c8nav',
    uploadPreset: 'upload_nlw'
}
const myWidget = cloudinary.createUploadWidget(
    config,
    async (error, result) => {
        if (!error && result && result.event === "success") {
            app.public_id = result.info.public_id;
            el.status.textContent = 'Processando transcrição...';
            try {
                const isReady = await app.waitForTranscription();
                if (!isReady) {
                    el.status.textContent = 'Erro ao buscar transcrição.';
                    throw new Error('Erro ao buscar transcrição')
                }
                el.status.textContent = 'Gerando clipe viral...';
                const viralMoment = await app.getViralMoment();
                const viralMomentUrl = `https://res.cloudinary.com/${config.cloudName}/video/upload/${viralMoment}/${app.public_id}.mp4`;
                el.video.setAttribute('src', viralMomentUrl)
                el.status.textContent = 'Pronto! Assista ao momento viral.';
            } catch (error) {
                el.status.textContent = 'Erro no processamento.';
            }
        }
    }
)
el.button.addEventListener("click", () => {
    if(!el.apiKey.value){
        alert('Insira sua API do Gemini primeiro.')
        el.apiKey.focus()
        return
    }
    myWidget.open();
}, false);
