// functions/index.js
//
// Cloud Function que envia um e-mail para o administrador sempre que um
// novo anúncio (documento) é criado na coleção "animais" do Firestore.
//
// Usa o Gmail via SMTP (com "Senha de app") através da biblioteca nodemailer.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

// Os dois segredos abaixo NÃO ficam escritos no código — são configurados
// separadamente via linha de comando (veja o SETUP.md) e ficam guardados
// de forma criptografada pelo Google Cloud Secret Manager.
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

// E-mail que vai RECEBER as notificações. Pode ser o mesmo do GMAIL_USER,
// ou outro endereço, se preferir.
const EMAIL_DESTINO = "gabrielfleury34@gmail.com";

exports.notificarNovoAnuncio = onDocumentCreated(
  {
    document: "animais/{animalId}",
    secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
    region: "southamerica-east1", // São Paulo — deixa a função mais rápida para o Brasil
  },
  async (event) => {
    const dados = event.data?.data();
    if (!dados) {
      console.log("Nenhum dado encontrado no evento, ignorando.");
      return;
    }

    const transportador = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER.value(),
        pass: GMAIL_APP_PASSWORD.value(),
      },
    });

    const tituloAnimal =
      dados.tipo === "encontrado" ? "Animal Encontrado" : (dados.nomeAnimal || "Sem nome");

    const linkFoto = dados.fotoUrl || "";

    const corpoEmail = `
      <h2>Novo anúncio publicado no PetBG 🐾</h2>
      <p><strong>Tipo:</strong> ${dados.label || dados.tipo}</p>
      <p><strong>Nome do animal / título:</strong> ${tituloAnimal}</p>
      <p><strong>Nome da pessoa:</strong> ${dados.nomePessoa || "Não informado"}</p>
      <p><strong>Porte:</strong> ${dados.porte || "Não informado"}</p>
      <p><strong>Contato (WhatsApp):</strong> ${dados.contato || "Não informado"}</p>
      <p><strong>Bairro:</strong> ${dados.bairro || "Não informado"}</p>
      ${dados.pontoReferencia ? `<p><strong>Referência:</strong> ${dados.pontoReferencia}</p>` : ""}
      ${dados.estadoAnimal ? `<p><strong>Estado do animal:</strong> ${dados.estadoAnimal}</p>` : ""}
      ${linkFoto ? `<p><img src="${linkFoto}" alt="Foto do animal" style="max-width: 300px; border-radius: 8px;" /></p>` : ""}
      <p style="color: #888; font-size: 0.85rem;">Este e-mail foi enviado automaticamente pelo sistema PetBG.</p>
    `;

    try {
      await transportador.sendMail({
        from: `"PetBG - Notificações" <${GMAIL_USER.value()}>`,
        to: EMAIL_DESTINO,
        subject: `Novo anúncio: ${dados.label || dados.tipo} - ${tituloAnimal}`,
        html: corpoEmail,
      });
      console.log("E-mail de notificação enviado com sucesso.");
    } catch (erro) {
      console.error("Erro ao enviar e-mail de notificação:", erro);
    }
  }
);
