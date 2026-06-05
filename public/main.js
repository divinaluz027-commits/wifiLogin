document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  // Captura e armazena os parâmetros enviados pelo roteador/gateway na URL
  const salvarParametrosHotspot = () => {
    const params = new URLSearchParams(window.location.search);
    const keys = ['mac', 'ip', 'link-login', 'link-orig', 'error'];
    
    keys.forEach(key => {
      if (params.has(key)) {
        sessionStorage.setItem(`hotspot_${key}`, params.get(key));
      }
    });
  };
  salvarParametrosHotspot();

  // Função para liberar a internet no roteador/gateway (Configurável pelo outro DEV)
  const liberarInternetNoRoteador = async (username, password) => {
    const linkLogin = sessionStorage.getItem('hotspot_link-login');
    const mac = sessionStorage.getItem('hotspot_mac');
    const ip = sessionStorage.getItem('hotspot_ip');
    const linkOrig = sessionStorage.getItem('hotspot_link-orig') || 'https://google.com';

    console.log('Dados do Roteador Capturados:', { linkLogin, mac, ip, linkOrig });

    if (!linkLogin) {
      console.log('Sem parâmetros de gateway Wi-Fi. Simulação de sucesso local.');
      alert('Conectado com sucesso! (Simulação de liberação local)');
      return;
    }

    // --- OPÇÃO A: MIKROTIK / pfSENSE TRADICIONAL (ENVIO VIA FORMULÁRIO POST OCULTO) ---
    // O outro desenvolvedor pode descomentar e ajustar conforme o hotspot da rede:
    /*
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = linkLogin;

    // Campos padrões do Mikrotik Hotspot
    const inputUser = document.createElement('input');
    inputUser.type = 'hidden';
    inputUser.name = 'username';
    inputUser.value = username;
    form.appendChild(inputUser);

    const inputPass = document.createElement('input');
    inputPass.type = 'hidden';
    inputPass.name = 'password';
    inputPass.value = password;
    form.appendChild(inputPass);

    const inputDst = document.createElement('input');
    inputDst.type = 'hidden';
    inputDst.name = 'dst';
    inputDst.value = linkOrig;
    form.appendChild(inputDst);

    document.body.appendChild(form);
    form.submit();
    */

    // --- OPÇÃO B: INTEGRAÇÃO VIA API BACKEND (EX: UNIFI CONTROLER / MERAKI) ---
    // Caso o roteador precise ser liberado via chamada de API no Backend Express:
    /*
    try {
      await fetch('/api/wifi/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac, ip, username })
      });
      window.location.href = linkOrig;
    } catch (e) {
      console.error('Erro na autorização da API do Wi-Fi:', e);
    }
    */
  };

  // Função de validação customizada, elegante e com textos explicativos
  const validateForm = (form) => {
    let isValid = true;
    const inputs = form.querySelectorAll('input');
    
    inputs.forEach(input => {
      let isFieldValid = true;
      let errorMessage = '';

      // Validação de campo obrigatório
      if (input.type === 'checkbox') {
        if (input.hasAttribute('required') && !input.checked) {
          isFieldValid = false;
          errorMessage = 'Você precisa aceitar os termos para continuar.';
        }
      } else if (input.hasAttribute('required') && !input.value.trim()) {
        isFieldValid = false;
        errorMessage = 'Por favor, preencha este campo.';
      }
      // Validação de formato de email
      else if (input.type === 'email' && input.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.value.trim())) {
          isFieldValid = false;
          errorMessage = 'Por favor, digite um e-mail válido.';
        }
      }

      // Remover mensagens de erro anteriores para evitar duplicações
      const existingError = input.closest('.input-group').querySelector('.error-message');
      if (existingError) {
        existingError.remove();
      }

      if (!isFieldValid) {
        input.classList.add('invalid');
        isValid = false;

        // Cria e insere o texto do aviso logo abaixo do input
        const errorSpan = document.createElement('span');
        errorSpan.className = 'error-message';
        errorSpan.textContent = errorMessage;
        input.closest('.input-group').appendChild(errorSpan);
      } else {
        input.classList.remove('invalid');
      }
      
      // Limpa o vermelho e o texto do erro assim que o usuário começar a digitar/corrigir
      const cleanError = () => {
        input.classList.remove('invalid');
        const errorSpan = input.closest('.input-group').querySelector('.error-message');
        if (errorSpan) {
          errorSpan.remove();
        }
      };
      
      input.addEventListener('input', cleanError);
      input.addEventListener('change', cleanError);
    });
    
    return isValid;
  };

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageEl = document.getElementById('loginMessage');
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      
      // Executa validação customizada
      if (!validateForm(loginForm)) {
        messageEl.textContent = 'Por favor, preencha corretamente os campos destacados.';
        messageEl.className = 'message error';
        return;
      }

      submitBtn.classList.add('loading');

      const email = document.getElementById('email').value;
      const telefone = document.getElementById('telefone').value;
      const macAddress = sessionStorage.getItem('hotspot_mac') || null;
      const ipAddress = sessionStorage.getItem('hotspot_ip') || null;
      
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, telefone, macAddress, ipAddress })
        });
        
        const data = await response.json();
        submitBtn.classList.remove('loading');
        
        if (response.ok) {
          messageEl.textContent = 'Login bem-sucedido! Conectando à rede...';
          messageEl.className = 'message success';
          // Token JWT agora é armazenado automaticamente via cookie HttpOnly (seguro contra XSS)
          
          // Tenta liberar a internet do usuário no roteador Wi-Fi
          setTimeout(() => {
            liberarInternetNoRoteador(email, telefone);
          }, 1500);
        } else {
          messageEl.textContent = data.error || 'Erro ao fazer login.';
          messageEl.className = 'message error';
        }
      } catch (error) {
        submitBtn.classList.remove('loading');
        messageEl.textContent = 'Erro de conexão.';
        messageEl.className = 'message error';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageEl = document.getElementById('registerMessage');
      const submitBtn = registerForm.querySelector('button[type="submit"]');

      // Executa validação customizada
      if (!validateForm(registerForm)) {
        messageEl.textContent = 'Por favor, preencha corretamente os campos destacados.';
        messageEl.className = 'message error';
        return;
      }

      submitBtn.classList.add('loading');

      const nome = document.getElementById('nome').value;
      const email = document.getElementById('email').value;
      const telefone = document.getElementById('telefone').value;
      const macAddress = sessionStorage.getItem('hotspot_mac') || null;
      const ipAddress = sessionStorage.getItem('hotspot_ip') || null;
      
      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ nome, email, telefone, macAddress, ipAddress })
        });
        
        const data = await response.json();
        submitBtn.classList.remove('loading');
        
        if (response.ok) {
          messageEl.textContent = 'Cadastro realizado com sucesso! Conectando à rede...';
          messageEl.className = 'message success';
          
          // Libera a internet no roteador automaticamente após cadastrar
          setTimeout(() => {
            liberarInternetNoRoteador(email, telefone);
          }, 1500);

          registerForm.reset();
        } else {
          messageEl.textContent = data.error || 'Erro ao cadastrar.';
          messageEl.className = 'message error';
        }
      } catch (error) {
        submitBtn.classList.remove('loading');
        messageEl.textContent = 'Erro de conexão.';
        messageEl.className = 'message error';
      }
    });
  }
});
