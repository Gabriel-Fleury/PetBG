import { useState, useEffect } from 'react';
import './App.css';

// Importações do Firebase
import { db, storage } from './firebase';
import { collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

function App() {
  const [animais, setAnimais] = useState([]);
  const [filtro, setFiltro] = useState('todos'); // Estado para o Header
  const [modalAberto, setModalAberto] = useState(false);
  const [passo, setPasso] = useState(1);
  const [carregando, setCarregando] = useState(false); // Feedback visual de envio

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
        id: doc.id, // ID único gerado pelo Firebase
        ...doc.data()
      }));
      setAnimais(listaAnimais);
    }, (error) => {
      console.error("Erro ao buscar dados do Firestore: ", error);
    });

    return () => unsubscribe(); // Limpa o listener ao desmontar o componente
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

  // ADICIONAR REGISTRO: Upload da foto + Salvamento dos dados
  const salvarAnimal = async (e) => {
    e.preventDefault();
    if (!novoPet.foto) return alert("Por favor, selecione uma foto.");
    
    setCarregando(true);

    try {
      // 1. Upload da imagem para o Firebase Storage
      const nomeArquivo = `${Date.now()}_${novoPet.foto.name}`;
      const storageRef = ref(storage, `pets/${nomeArquivo}`);
      
      const snapshot = await uploadBytes(storageRef, novoPet.foto);
      const fotoUrlPublica = await getDownloadURL(snapshot.ref);

      // 2. Preparação do objeto para o Firestore
      const animalCompleto = {
        tipo: novoPet.tipo,
        nomePessoa: novoPet.nomePessoa,
        nomeAnimal: novoPet.tipo === 'encontrado' ? '' : novoPet.nomeAnimal,
        porte: novoPet.porte,
        contato: novoPet.contato,
        bairro: novoPet.bairro || '',
        pontoReferencia: novoPet.pontoReferencia || '',
        estadoAnimal: novoPet.estadoAnimal || '',
        fotoUrl: fotoUrlPublica, // URL final vinda do Storage
        label: novoPet.tipo === 'doacao' ? 'Adoção' : novoPet.tipo.charAt(0).toUpperCase() + novoPet.tipo.slice(1),
        criadoEm: Date.now() // Carimbo de data para ordenação
      };

      // 3. Salva o documento na coleção "animais"
      await addDoc(collection(db, 'animais'), animalCompleto);
      
      fecharModal();
    } catch (erro) {
      console.error("Erro ao publicar anúncio: ", erro);
      alert("Houve um erro ao enviar os dados. Tente novamente.");
      setCarregando(false);
    }
  };

  // EXCLUSÃO MANUAL COM VALIDAÇÃO DE SENHA
  const deletarAnimal = async (id, fotoUrl) => {
    // 1. Pede a senha do administrador antes de prosseguir
    const senhaDigitada = window.prompt("Digite a senha de administrador para excluir este anúncio:");
    
    // Altere 'petbg2026' para a senha secreta que você preferir usar no site
    if (senhaDigitada !== 'admin123') {
      alert("Senha incorreta! Você não tem autorização para excluir.");
      return;
    }

    const confirmar = window.confirm("Senha correta. Tem certeza que deseja remover este anúncio permanentemente do PetBG?");
    if (!confirmar) return;

    try {
      // 1. Remove do banco de dados (Firestore)
      await deleteDoc(doc(db, "animais", id));

      // 2. Remove o arquivo de imagem correspondente (Storage)
      if (fotoUrl) {
        const referenciaFoto = ref(storage, fotoUrl);
        await deleteObject(referenciaFoto);
      }

      alert("Anúncio removido com sucesso!");
    } catch (erro) {
      console.error("Erro ao deletar o anúncio:", erro);
      alert("Não foi possível excluir o anúncio. Tente novamente.");
    }
  };

  // Lógica de Filtragem de abas
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
            
            {/* O botão "X" fica visível para todos, mas protegido pela senha */}
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
                <p className="local-info">📍 {animal.bairro} <br/> <small>Ref: {animal.pontoReferencia}</small></p>
              )}

              <a 
                href={`https://wa.me/55${animal.contato.replace(/\D/g, '')}?text=Olá! Vi o anúncio no PetBG e gostaria de informações.`}
                target="_blank" 
                rel="noreferrer"
                className="btn-whatsapp"
              >
                Entrar em contato
              </a>
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
                      <input placeholder="Bairro *" value={novoPet.bairro} onChange={(e) => setNovoPet({...novoPet, bairro: e.target.value})} required disabled={carregando} />
                      <input placeholder="Referência *" value={novoPet.pontoReferencia} onChange={(e) => setNovoPet({...novoPet, pontoReferencia: e.target.value})} required disabled={carregando} />
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