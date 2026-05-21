import { useState, useEffect } from 'react';
import './App.css';

// Importações do Firebase
import { db, storage } from './firebase';
import { collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

function App() {
  const [animais, setAnimais] = useState([]);
  const [filtro, setFiltro] = useState('todos'); 
  const [modalAberto, setModalAberto] = useState(false);
  const [passo, setPasso] = useState(1);
  const [carregando, setCarregando] = useState(false); 
  const [copiadoId, setCopiadoId] = useState(null); 

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
    }, (error) => {
      console.error("Erro ao buscar dados do Firestore: ", error);
    });

    return () => unsubscribe(); 
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
    
    // Formata no padrão brasileiro: DD/MM/AAAA às HH:MM
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
        criadoEm: Date.now() // Captura o horário exato do servidor/máquina de forma oculta
      };

      await addDoc(collection(db, 'animais'), animalCompleto);
      fecharModal();
    } catch (erro) {
      console.error("Erro ao publicar anúncio: ", erro);
      alert("Houve um erro ao enviar os dados. Tente novamente.");
      setCarregando(false);
    }
  };

  // EXCLUSÃO MANUAL COM VALIDAÇÃO DE SENHA (Vite)
  const deletarAnimal = async (id, fotoUrl) => {
    const senhaDigitada = window.prompt("Digite a senha de administrador para excluir este anúncio:");
    const SENHA_ADMIN = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

    if (senhaDigitada !== SENHA_ADMIN) {
      alert("Senha incorreta! Você não tem autorização para excluir.");
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
      alert("Anúncio removido com sucesso!");
    } catch (erro) {
      console.error("Erro ao deletar o anúncio:", erro);
      alert("Não foi possível excluir o anúncio.");
    }
  };

  const animaisFiltrados = animais.filter(animal => 
    filtro === 'todos' || animal.tipo === filtro
  );

  return (
    <div className="container">
      {/* HEADER COM FILTROS */}
      <header className="main-header">
        <h1 className="nome-da-pagina">PetBG</h1>
        <nav className="nav-filtros">
          <button className={filtro === 'todos' ? 'active' : ''} onClick={() => setFiltro('todos')}>Todos</button>
          <button className={filtro === 'doacao' ? 'active' : ''} onClick={() => setFiltro('doacao')}>Adoção</button>
          <button className={filtro === 'perdido' ? 'active' : ''} onClick={() => setFiltro('perdido')}>Perdidos</button>
          <button className={filtro === 'encontrado' ? 'active' : ''} onClick={() => setFiltro('encontrado')}>Encontrados</button>
        </nav>
      </header>

      {/* GRADE DE ANÚNCIOS */}
      <main className="grid-container">
        {animaisFiltrados.length === 0 && (
          <p className="msg-vazio">Nenhum anúncio encontrado nesta categoria.</p>
        )}
        
        {animaisFiltrados.map((animal) => (
          <div key={animal.id} className={`card card-${animal.tipo}`}>
            
            <button 
              className="btn-deletar-admin" 
              onClick={() => deletarAnimal(animal.id, animal.fotoUrl)}
              title="Excluir Anúncio"
            >
              &times;
            </button>

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

              {/* DATA E HORA DO POST (Gerado automaticamente pelo sistema) */}
              <p className="post-data">
                📅 {formatarData(animal.criadoEm)}
              </p>

              {/* CONTAINER DE BOTÕES DE AÇÃO */}
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

      {/* BOTÃO FLUTUANTE PARA CADASTRAR */}
      <button className="fab" onClick={() => setModalAberto(true)}>+</button>

      {/* MODAL DE CADASTRO */}
      {modalAberto && (
        <div className="overlay">
          <div className="modal-card">
            <button className="btn-fechar" onClick={fecharModal} disabled={carregando}>&times;</button>
            
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
    </div>
  );
}

export default App;