# 🌟 Divina Luz Wi-Fi — Hotspot Login/Cadastro Estático

Sistema de autenticação estático para portal hotspot Wi-Fi, feito puramente com **HTML5, CSS3 e JavaScript (Vanilla)**.

---

## 📁 Estrutura do Projeto

```
loginCadastroDivinaLuz/
└── public/
    ├── index.html          ← Página de Login
    ├── register.html       ← Página de Cadastro
    ├── main.js             ← Lógica de validação e integração Wi-Fi
    ├── style.css           ← Estilização Glassmorphism
    └── logoDvLuz.webp      ← Logo oficial
```

---

## 📡 Integração com Gateway Wi-Fi (Hotspot)

O arquivo `main.js` captura automaticamente os parâmetros passados pelo roteador na URL e os salva no `sessionStorage`:

- `mac`: Endereço MAC do dispositivo cliente
- `ip`: IP do cliente na rede
- `link-login`: Endpoint para autenticação do gateway (ex: Mikrotik / pfSense)
- `link-orig`: URL de redirecionamento original do cliente

### Customização no `main.js`
- **Mikrotik/pfSense (POST Oculto)**: Ajuste os campos padrões na função `liberarInternetNoRoteador()` do `main.js`.
- **API Externa**: Ajuste a chamada do `fetch()` em `liberarInternetNoRoteador()`.
