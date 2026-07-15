import { useState, useEffect } from 'react';
import './App.css';
import logoPetBG from './assets/logo.svg';

// Importações do Firebase
import { db, storage, auth } from './firebase'; // 'auth' foi adicionado
import { collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'; // NOVO

function App() {
  const [animais, setAnimais] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [passo, setPasso] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(true); // NOVO: loading inicial da lista
  const [copiadoId, setCopiadoId] = useState(null);

  // --- NOVO: estado de autenticação do administrador ---
  const [usuarioAdmin, setUsuarioAdmin] = useState(null); // null = deslogado
  const [modalLoginAberto, setModalLoginAberto] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [carregandoLogin, setCarregandoLogin] = useState(false);

  const estadoInicial = {
    tipo: '',
    nomePessoa: '',
    nomeAnimal: '',
    porte: 'médio',
    contato: '',
    bairro: '',
    pontoReferencia: '',
    estadoAnimal: '',
    foto: null
  };

  const [novoPet, setNovoPet] = useState(estadoInicial);

  // BUSCA EM TEMPO REAL: Monitora a coleção "animais" ordenada pelos mais recentes
  useEffect(() => {
    const q = query(collection(db, 'animais'), orderBy('criadoEm', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listaAnimais = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAnimais(listaAnimais);
      setCarregandoLista(false);
    }, (error) => {
      console.error("Erro ao buscar dados do Firestore: ", error);
      setCarregandoLista(false);
    });

    return () => unsubscribe();
  }, []);

  // NOVO: observa o estado de login do administrador em tempo real.
  // Isso garante que, se a sessão expirar ou o admin deslogar em outra aba,
  // a interface reaja imediatamente (ex: escondendo os botões de excluir).
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUsuarioAdmin(user);
    });
    return () => unsubscribeAuth();
  }, []);

  const selecionarTipo = (tipo) => {
    setNovoPet({ ...novoPet, tipo });
    setPasso(2);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setNovoPet(estadoInicial);
    setPasso(1);
    setCarregando(false);
  };

  // FUNÇÃO AUXILIAR: Formata o timestamp gerado pelo sistema
  const formatarData = (timestamp) => {
    if (!timestamp) return "";
    const data = new Date(timestamp);

    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' às ' + data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // COPIAR LINK DO ANÚNCIO
  const copiarLinkAnuncio = (animal) => {
    const urlBase = window.location.origin + window.location.pathname;
    const linkCompleto = `${urlBase}?pet=${animal.id}`;

    const textoParaCopiar = `🚨 *PETBG BARRA DO GARÇAS* 🚨\n` +
      `Status: *${animal.label}*\n` +
      `${animal.tipo === 'encontrado' ? 'Animal Encontrado' : `Nome: *${animal.nomeAnimal}*`}\n` +
      `Bairro: ${animal.bairro || 'Não informado'}\n\n` +
      `Veja a foto e ajude compartilhando: ${linkCompleto}`;

    navigator.clipboard.writeText(textoParaCopiar).then(() => {
      setCopiadoId(animal.id);
      setTimeout(() => {
        setCopiadoId(null);
      }, 2000);
    }).catch((erro) => {
      console.error("Erro ao copiar link: ", erro);
      alert("Não foi possível copiar automaticamente.");
    });
  };

  // ADICIONAR REGISTRO: Upload da foto + Salvamento dos dados
  const salvarAnimal = async (e) => {
    e.preventDefault();
    if (!novoPet.foto) return alert("Por favor, selecione uma foto.");

    // NOVO: validação básica de tipo e tamanho de arquivo no cliente.
    // Isso melhora a experiência do usuário, mas a validação "de verdade"
    // deve estar nas Storage Rules (veja storage.rules) — nunca confie só
    // no que roda no navegador.
    const TAMANHO_MAXIMO_MB = 5;
    if (!novoPet.foto.type.startsWith('image/')) {
      return alert("O arquivo selecionado precisa ser uma imagem.");
    }
    if (novoPet.foto.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
      return alert(`A imagem deve ter no máximo ${TAMANHO_MAXIMO_MB}MB.`);
    }

    if ((novoPet.tipo === 'perdido' || novoPet.tipo === 'encontrado') && !novoPet.bairro) {
      return alert("Por favor, preencha o campo Bairro.");
    }

    setCarregando(true);

    try {
      const nomeArquivo = `${Date.now()}_${novoPet.foto.name}`;
      const storageRef = ref(storage, `pets/${nomeArquivo}`);

      const snapshot = await uploadBytes(storageRef, novoPet.foto);
      const fotoUrlPublica = await getDownloadURL(snapshot.ref);

      const animalCompleto = {
        tipo: novoPet.tipo,
        nomePessoa: novoPet.nomePessoa,
        nomeAnimal: novoPet.tipo === 'encontrado' ? '' : novoPet.nomeAnimal,
        porte: novoPet.porte,
        contato: novoPet.contato,
        bairro: novoPet.tipo !== 'doacao' ? novoPet.bairro : '',
        pontoReferencia: novoPet.tipo !== 'doacao' ? novoPet.pontoReferencia : '',
        estadoAnimal: novoPet.tipo === 'encontrado' ? novoPet.estadoAnimal : '',
        fotoUrl: fotoUrlPublica,
        label: novoPet.tipo === 'doacao' ? 'Adoção' : novoPet.tipo.charAt(0).toUpperCase() + novoPet.tipo.slice(1),
        criadoEm: Date.now()
      };

      await addDoc(collection(db, 'animais'), animalCompleto);
      fecharModal();
    } catch (erro) {
      console.error("Erro ao publicar anúncio: ", erro);
      alert("Houve um erro ao enviar os dados. Tente novamente.");
      setCarregando(false);
    }
  };

  // EXCLUSÃO: agora protegida por autenticação real do Firebase (não por senha no código).
  // O botão de excluir só aparece para quem estiver logado como admin (ver JSX abaixo),
  // e as Firestore/Storage Rules também bloqueiam a exclusão no backend caso alguém
  // tente burlar a interface.
  const deletarAnimal = async (id, fotoUrl) => {
    if (!usuarioAdmin) {
      alert("Você precisa estar logado como administrador para excluir.");
      return;
    }

    const confirmar = window.confirm("Tem certeza que deseja remover este anúncio permanentemente?");
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "animais", id));
      if (fotoUrl) {
        const referenciaFoto = ref(storage, fotoUrl);
        await deleteObject(referenciaFoto);
      }
    } catch (erro) {
      console.error("Erro ao deletar o anúncio:", erro);
      alert("Não foi possível excluir o anúncio. Verifique se sua sessão de administrador ainda está ativa.");
    }
  };

  // NOVO: login do administrador via Firebase Authentication (e-mail/senha).
  // A senha nunca fica no código-fonte nem é validada no navegador —
  // quem confirma a senha é o próprio Firebase, no servidor.
  const fazerLogin = async (e) => {
    e.preventDefault();
    setErroLogin('');
    setCarregandoLogin(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginSenha);
      setModalLoginAberto(false);
      setLoginEmail('');
      setLoginSenha('');
    } catch (erro) {
      console.error("Erro no login:", erro);
      setErroLogin("E-mail ou senha inválidos.");
    } finally {
      setCarregandoLogin(false);
    }
  };

  const fazerLogout = async () => {
    await signOut(auth);
  };

  const animaisFiltrados = animais.filter(animal =>
    filtro === 'todos' || animal.tipo === filtro
  );

  return (
    <div className="container">
      {/* HEADER COM FILTROS */}
      <header className="main-header">
       <h1 className="nome-da-pagina">
          <img src={logoPetBG} alt="PetBG Logo" className="logo-site" />
       </h1>
        <nav className="nav-filtros">
          <button className={filtro === 'todos' ? 'active' : ''} onClick={() => setFiltro('todos')}>Todos</button>
          <button className={filtro === 'doacao' ? 'active' : ''} onClick={() => setFiltro('doacao')}>Adoção</button>
          <button className={filtro === 'perdido' ? 'active' : ''} onClick={() => setFiltro('perdido')}>Perdidos</button>
          <button className={filtro === 'encontrado' ? 'active' : ''} onClick={() => setFiltro('encontrado')}>Encontrados</button>
        </nav>

        {/* NOVO: indicador de sessão de admin + botão de logout, visível só quando logado */}
        {usuarioAdmin && (
          <div className="admin-bar">
            <span>Logado como admin</span>
            <button onClick={fazerLogout} className="btn-logout">Sair</button>
          </div>
        )}
      </header>

      {/* GRADE DE ANÚNCIOS */}
      <main className="grid-container">
        {carregandoLista && (
          <p className="msg-vazio">Carregando anúncios...</p>
        )}

        {!carregandoLista && animaisFiltrados.length === 0 && (
          <p className="msg-vazio">Nenhum anúncio encontrado nesta categoria.</p>
        )}

        {!carregandoLista && animaisFiltrados.map((animal) => (
          <div key={animal.id} className={`card card-${animal.tipo}`}>

            {/* O botão de excluir só é renderizado se houver um admin autenticado */}
            {usuarioAdmin && (
              <button
                className="btn-deletar-admin"
                onClick={() => deletarAnimal(animal.id, animal.fotoUrl)}
                title="Excluir Anúncio"
                aria-label="Excluir anúncio"
              >
                &times;
              </button>
            )}

            <div className="card-foto-container">
              {animal.fotoUrl ? (
                <img src={animal.fotoUrl} alt="Pet" className="card-img" />
              ) : (
                <div className="card-foto-placeholder">Sem Foto</div>
              )}
            </div>

            <div className="card-content">
              <span className="tag">{animal.label}</span>
              <h3>{animal.tipo === 'encontrado' ? 'Animal Encontrado' : animal.nomeAnimal}</h3>

              <p><strong>Porte:</strong> {animal.porte}</p>

              {animal.tipo === 'encontrado' && animal.estadoAnimal && (
                <p className="status-animal"><strong>Saúde:</strong> {animal.estadoAnimal}</p>
              )}

              {animal.bairro && (
                <p className="local-info">
                  📍 {animal.bairro}
                  {animal.pontoReferencia && <><br/><small>Ref: {animal.pontoReferencia}</small></>}
                </p>
              )}

              <p className="post-data">
                📅 {formatarData(animal.criadoEm)}
              </p>

              <div className="card-botoes-container">
                <a
                  href={`https://wa.me/55${animal.contato.replace(/\D/g, '')}?text=Olá! Vi o anúncio no PetBG e gostaria de informações.`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-whatsapp"
                >
                  Entrar em contato
                </a>

                <button
                  onClick={() => copiarLinkAnuncio(animal)}
                  className={`btn-copiar ${copiadoId === animal.id ? 'sucesso' : ''}`}
                >
                  {copiadoId === animal.id ? '✨ Link Copiado!' : '🔗 Copiar Link para Stories'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </main>
      <footer className="main-footer">
  <div className="footer-container">

    <div className="footer-col branding">
      <img src={logoPetBG} alt="PetBG Logo" className="logo-site" />
      <p>Conectando pets e famílias em Barra do Garças. Ajude-nos a trazer mais finais felizes para a nossa comunidade.</p>
    </div>

    <div className="footer-links-wrapper">

      <div className="footer-col">
        <h4>Navegação</h4>
        <ul>
          <li><a href="#inicio">Início</a></li>
          <li><a href="#perdidos">Perdidos</a></li>
          <li><a href="#encontrados">Encontrados</a></li>
          <li><a href="#adocao">Adoção</a></li>
        </ul>
      </div>

      <div className="footer-col">
        <h4>Plataforma</h4>
        <ul>
          <li><a href="#sobre">Sobre o Projeto</a></li>
          <li><a href="#privacidade">Privacidade</a></li>
          {/* ALTERADO: agora abre o modal de login em vez de um link comum */}
          <li>
            {usuarioAdmin ? (
              <button className="link-admin link-admin-btn" onClick={fazerLogout}>
                Sair da Área do Administrador
              </button>
            ) : (
              <button className="link-admin link-admin-btn" onClick={() => setModalLoginAberto(true)}>
                Área do Administrador
              </button>
            )}
          </li>
        </ul>
      </div>

    </div>

  </div>

  <div className="footer-bottom">
    <p>&copy; {new Date().getFullYear()} PetBG. Desenvolvido com ❤️ em Barra do Garças - MT.</p>
  </div>
</footer>

      {/* BOTÃO FLUTUANTE PARA CADASTRAR */}
      <button className="fab" onClick={() => setModalAberto(true)} aria-label="Cadastrar novo anúncio">+</button>

      {/* MODAL DE CADASTRO */}
      {modalAberto && (
        <div className="overlay">
          <div className="modal-card">
            <button className="btn-fechar" onClick={fecharModal} disabled={carregando} aria-label="Fechar">&times;</button>

            {passo === 1 ? (
              <div className="selecao-tipo">
                <h2>O que você deseja anunciar em Barra do Garças?</h2>
                <button onClick={() => selecionarTipo('perdido')} className="btn-tipo perdido">Perdi um animal</button>
                <button onClick={() => selecionarTipo('encontrado')} className="btn-tipo encontrado">Encontrei um animal</button>
                <button onClick={() => selecionarTipo('doacao')} className="btn-tipo doacao">Colocar para adoção</button>
              </div>
            ) : (
              <form className="form-modal" onSubmit={salvarAnimal}>
                <h2>Detalhes do Anúncio</h2>

                <label className="label-foto">
                  Foto do Animal *:
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNovoPet({...novoPet, foto: e.target.files[0]})}
                    required
                    disabled={carregando}
                  />
                </label>

                <input
                  placeholder={novoPet.tipo === 'encontrado' ? "Seu Nome *" : "Nome da Pessoa *"}
                  value={novoPet.nomePessoa}
                  onChange={(e) => setNovoPet({...novoPet, nomePessoa: e.target.value})}
                  required
                  disabled={carregando}
                />

                {novoPet.tipo !== 'encontrado' && (
                  <input
                    placeholder="Nome do Animal *"
                    value={novoPet.nomeAnimal}
                    onChange={(e) => setNovoPet({...novoPet, nomeAnimal: e.target.value})}
                    required
                    disabled={carregando}
                  />
                )}

                <div className="campo-group">
                  <label>Porte do Animal *</label>
                  <select value={novoPet.porte} onChange={(e) => setNovoPet({...novoPet, porte: e.target.value})} required disabled={carregando}>
                    <option value="pequeno">Pequeno</option>
                    <option value="médio">Médio</option>
                    <option value="grande">Grande</option>
                  </select>
                </div>

                <input
                  placeholder="Seu WhatsApp (DDD + Número) *"
                  value={novoPet.contato}
                  onChange={(e) => setNovoPet({...novoPet, contato: e.target.value})}
                  required
                  disabled={carregando}
                />

                {(novoPet.tipo === 'perdido' || novoPet.tipo === 'encontrado') && (
                  <div className="area-local">
                    <p className="aviso-local">*{novoPet.tipo === 'perdido' ? 'Último local visto' : 'Local que encontrei'}*</p>
                    <div className="row">
                      <input placeholder="Bairro *" value={novoPet.bairro} onChange={(e) => setNovoPet({...novoPet, bairro: e.target.value})} disabled={carregando} />
                      <input placeholder="Referência" value={novoPet.pontoReferencia} onChange={(e) => setNovoPet({...novoPet, pontoReferencia: e.target.value})} disabled={carregando} />
                    </div>
                  </div>
                )}

                {novoPet.tipo === 'encontrado' && (
                  <textarea
                    placeholder="Estado do animal (Ex: ferido, dócil, assustado...) *"
                    value={novoPet.estadoAnimal}
                    onChange={(e) => setNovoPet({...novoPet, estadoAnimal: e.target.value})}
                    required
                    disabled={carregando}
                  />
                )}

                <button type="submit" className="btn-enviar" disabled={carregando}>
                  {carregando ? "Publicando..." : "Publicar Agora"}
                </button>
                <button type="button" onClick={() => setPasso(1)} className="btn-voltar" disabled={carregando}>Voltar</button>
              </form>
            )}
          </div>
        </div>

      )}

      {/* NOVO: MODAL DE LOGIN DO ADMINISTRADOR */}
      {modalLoginAberto && (
        <div className="overlay">
          <div className="modal-card modal-login">
            <button
              className="btn-fechar"
              onClick={() => { setModalLoginAberto(false); setErroLogin(''); }}
              disabled={carregandoLogin}
              aria-label="Fechar"
            >
              &times;
            </button>

            <form className="form-modal" onSubmit={fazerLogin}>
              <h2>Área do Administrador</h2>
              <p className="aviso-local">Faça login para gerenciar os anúncios.</p>

              <input
                type="email"
                placeholder="E-mail"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                disabled={carregandoLogin}
                autoComplete="username"
              />

              <input
                type="password"
                placeholder="Senha"
                value={loginSenha}
                onChange={(e) => setLoginSenha(e.target.value)}
                required
                disabled={carregandoLogin}
                autoComplete="current-password"
              />

              {erroLogin && <p className="erro-login">{erroLogin}</p>}

              <button type="submit" className="btn-enviar" disabled={carregandoLogin}>
                {carregandoLogin ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
