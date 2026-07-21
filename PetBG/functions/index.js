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
// separadamente via linha de comando (firebase functions:secrets:set) e
// ficam guardados de forma criptografada pelo Google Cloud Secret Manager.
// GMAIL_USER = e-mail que ENVIA a notificação.
// GMAIL_APP_PASSWORD = senha de app gerada no Google (não é a senha normal
// da conta), usada para autenticar o envio via SMTP.
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

// E-mail que vai RECEBER as notificações. Pode ser o mesmo do GMAIL_USER,
// ou outro endereço, se preferir.
const EMAIL_DESTINO = "gabrielfleury34@gmail.com";

// onDocumentCreated: gatilho do Firestore que dispara automaticamente
// toda vez que um NOVO documento é criado na coleção informada.
// Não precisa ser chamado manualmente em nenhum lugar do App.jsx —
// o Firebase observa a coleção sozinho, em segundo plano.
exports.notificarNovoAnuncio = onDocumentCreated(
  {
    // Caminho da coleção observada. "{animalId}" é um parâmetro de
    // wildcard — representa o ID de qualquer documento criado ali dentro,
    // mesmo que a função em si não use esse valor diretamente.
    document: "animais/{animalId}",

    // Lista de segredos que essa função tem permissão de usar.
    // Sem declarar aqui, o GMAIL_USER.value() e GMAIL_APP_PASSWORD.value()
    // mais abaixo ficariam vazios/inacessíveis.
    secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],

    // Região onde a função roda. São Paulo deixa a execução mais rápida
    // para o público brasileiro do site.
    region: "southamerica-east1",
  },

  // Função executada automaticamente sempre que o gatilho dispara.
  // "event" contém os dados do documento recém-criado.
  async (event) => {
    // event.data é o "snapshot" do documento; .data() extrai os campos
    // reais (tipo, nomeAnimal, contato, etc.) como um objeto JS comum.
    const dados = event.data?.data();

    // Proteção: se por algum motivo não vier nenhum dado (evento
    // corrompido ou incompleto), não tenta montar/enviar e-mail — só
    // registra no log e encerra.
    if (!dados) {
      console.log("Nenhum dado encontrado no evento, ignorando.");
      return;
    }

    // Configura o "transportador" do nodemailer: a peça responsável por
    // efetivamente conectar no servidor do Gmail e enviar o e-mail.
    // service: "gmail" já configura host/porta corretos automaticamente.
    const transportador = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER.value(),       // .value() lê o segredo em tempo de execução
        pass: GMAIL_APP_PASSWORD.value(),
      },
    });

    // Decide o "título" que aparece no e-mail: se for um post de animal
    // encontrado, não existe nome cadastrado (o formulário não pede),
    // então usa um texto genérico. Caso contrário, usa o nome do animal.
    const tituloAnimal =
      dados.tipo === "encontrado" ? "Animal Encontrado" : (dados.nomeAnimal || "Sem nome");

    // fotoUrl pode não existir em teoria (embora o formulário exija foto),
    // então usamos uma string vazia como segurança extra.
    const linkFoto = dados.fotoUrl || "";

    // Monta o corpo do e-mail em HTML. Os "${dados.campo || 'Não informado'}"
    // são só uma proteção para não aparecer "undefined" caso algum campo
    // esteja vazio. Os trechos com operador ternário (condição ? 'html' : '')
    // só incluem aquele bloco no e-mail se o dado realmente existir
    // (ex: só mostra "Referência" se o usuário preencheu esse campo).
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

    // Tenta enviar o e-mail. Qualquer erro aqui (senha errada, Gmail
    // bloqueando o envio, sem internet, etc.) é capturado e só registrado
    // no log — não trava nem quebra a criação do anúncio no site, já que
    // esse código roda de forma independente/assíncrona em relação ao
    // formulário do usuário.
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