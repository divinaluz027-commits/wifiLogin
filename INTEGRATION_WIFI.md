# Guia de Integração do Hotspot Wi-Fi (Captive Portal)

Este projeto foi preparado estruturalmente para funcionar como uma **Página de Captura (Captive Portal / Hotspot)** para redes Wi-Fi (como Mikrotik, pfSense, UniFi, CoovaChilli, etc.).

Como o fluxo de autenticação de Wi-Fi exige que o usuário se cadastre/autentique no seu banco de dados MySQL **e depois** seja liberado no roteador/gateway, o sistema já está configurado para capturar os parâmetros da rede e realizar a liberação automática.

---

## ⚙️ O que já está pronto para você configurar:

### 1. Captura de Parâmetros do Gateway (Frontend - `main.js`)
Quando um cliente se conecta no Wi-Fi, o roteador o redireciona para esta página inserindo parâmetros na URL (Query Strings). O arquivo `public/main.js` já captura e armazena automaticamente estes parâmetros em `sessionStorage`:
*   `link-login` (URL de login do roteador, ex: `http://192.168.88.1/login`)
*   `link-orig` (Site original que o usuário tentou acessar)
*   `mac` (Endereço MAC do dispositivo do usuário)
*   `ip` (Endereço IP do dispositivo do usuário)

### 2. Fluxo de Autenticação Dupla
O fluxo de login/cadastro foi preparado da seguinte forma:
1.  **Passo 1 (Seu Banco de Dados):** O usuário preenche o formulário. Os dados são enviados via AJAX/Fetch para o seu servidor Node.js/Express, salvando ou validando o usuário no banco MySQL (`divina_luz`).
2.  **Passo 2 (Roteador/Gateway):** Se o passo 1 for bem-sucedido, o frontend intercepta a resposta e faz o envio dos dados (ou usuário e senha do Radius) para a URL de login do roteador (`link-login`), liberando a internet do usuário de forma transparente.

---

## 🛠️ Onde você deve mexer (Tarefas do Desenvolvedor):

### 1. No Servidor Node.js (`server.js`)
Se você estiver utilizando um servidor **RADIUS** integrado com o banco de dados MySQL:
*   A senha é salva com criptografia `bcrypt` no banco de dados. Se o seu roteador/Radius precisar ler a senha em texto limpo (ex: PAP no Mikrotik), você pode desativar o hash `bcrypt` na rota `/api/register` em `server.js` ou configurar o Radius para validar usando um script customizado que leia a hash `bcrypt`.

Se você quiser automatizar a liberação via API (ex: API do UniFi ou API do Mikrotik RouterOS):
*   Na rota `/api/login` (ou `/api/register`), após o sucesso no banco, você pode fazer uma requisição interna do servidor Express diretamente para a API do seu controlador Wi-Fi para liberar o MAC address do usuário.
*   Exemplo de local no código: `server.js` na linha correspondente ao sucesso de login.

### 2. No Frontend (`public/main.js`)
Dentro do arquivo `public/main.js`, no sucesso do Login e do Cadastro, existe uma função pronta chamada `liberarInternetNoRoteador(email, senha)`. 
*   **Mikrotik / pfSense Tradicional:** Basta descomentar a seção de envio via formulário oculto (POST) para o `link-login` do roteador. O código para gerar esse envio de forma limpa já está esboçado lá.

---

## 📋 Como testar localmente simulando o Roteador:

Para simular o redirecionamento que o roteador Wi-Fi faz, acesse a página de login localmente usando parâmetros fictícios na URL:

```text
http://localhost:3000/index.html?mac=AA:BB:CC:DD:EE:FF&ip=10.0.0.50&link-login=http://localhost:3000/mock-login.html&link-orig=http://google.com
```

Isso fará com que o sistema salve os dados do dispositivo do usuário e se prepare para redirecioná-lo após o cadastro ou login!
