// Usando fetch nativo do Node.js (disponível a partir da v18)

async function testCreateMonitor() {
    try {
        // Primeiro, fazer login para obter o token
        console.log('🔐 Fazendo login...');
        const loginResponse = await fetch('http://localhost:8081/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'admin@agencia.com',
                password: 'admin123'
            })
        });

        if (!loginResponse.ok) {
            throw new Error(`Login falhou: ${loginResponse.status} ${loginResponse.statusText}`);
        }

        const loginData = await loginResponse.json();
        console.log('✅ Login realizado com sucesso');
        console.log('Token:', loginData.token.substring(0, 50) + '...');

        // Agora, tentar criar um monitor
        console.log('\n📊 Criando monitor...');
        const monitorData = {
            name: 'Página 1 Digital',
            url: 'https://pagina1digital.com.br',
            type: 'HTTP/HTTPS',
            interval: 300,
            timeout: 30,
            slug: 'pagina1digital',
            group_id: null,
            active: true,
            report_email: 'destino@hotmail.com',
            report_send_day: 1,
            report_send_time: '09:00'
        };

        const createResponse = await fetch('http://localhost:8081/api/monitors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginData.token}`
            },
            body: JSON.stringify(monitorData)
        });

        console.log('Status da resposta:', createResponse.status);
        console.log('Headers da resposta:', Object.fromEntries(createResponse.headers.entries()));

        const responseText = await createResponse.text();
        console.log('Resposta raw:', responseText);

        if (!createResponse.ok) {
            console.error('❌ Erro ao criar monitor:', createResponse.status, createResponse.statusText);
            console.error('Resposta:', responseText);
        } else {
            console.log('✅ Monitor criado com sucesso!');
            const responseData = JSON.parse(responseText);
            console.log('Dados do monitor:', responseData);
        }

    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
        console.error('Stack:', error.stack);
    }
}

testCreateMonitor();