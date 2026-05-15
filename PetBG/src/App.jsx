import { useState } from 'react';
import './App.css';

function App() {
  const [animais, setAnimais] = useState([]);
  const [filtro, setFiltro] = useState('todos'); // Estado para o Header
  const [modalAberto, setModalAberto] = useState(false);
  const [passo, setPasso] = useState(1);
  
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

  const selecionarTipo = (tipo) => {
    setNovoPet({ ...novoPet, tipo });
    setPasso(2);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setNovoPet(estadoInicial);
    setPasso(1);
  };

  const salvarAnimal = (e) => {
    e.preventDefault();

    const fotoUrlTemporaria = novoPet.foto ? URL.createObjectURL(novoPet.foto) : null;

    const animalCompleto = {
      ...novoPet,
      id: Date.now(),
      fotoUrl: fotoUrlTemporaria,
      label: novoPet.tipo === 'doacao' ? 'Adoção' : novoPet.tipo.charAt(0).toUpperCase() + novoPet.tipo.slice(1)
    };

    setAnimais([animalCompleto, ...animais]);
    fecharModal();
  };

  // Lógica de Filtragem
  const animaisFiltrados = animais.filter(animal => 
    filtro === 'todos' || animal.tipo === filtro
  );

  return (
    <div className="container">
      {/* HEADER COM FILTROS */}
      <header className="main-header">
        <h1 className="nome-da-pagina">AdotaPet</h1>
        <nav className="nav-filtros">
          <button className={filtro === 'todos' ? 'active' : ''} onClick={() => setFiltro('todos')}>Todos</button>
          <button className={filtro === 'doacao' ? 'active' : ''} onClick={() => setFiltro('doacao')}>Adoção</button>
          <button className={filtro === 'perdido' ? 'active' : ''} onClick={() => setFiltro('perdido')}>Perdidos</button>
          <button className={filtro === 'encontrado' ? 'active' : ''} onClick={() => setFiltro('encontrado')}>Encontrados</button>
        </nav>
      </header>

      <main className="grid-container">
        {animaisFiltrados.length === 0 && (
          <p className="msg-vazio">Nenhum anúncio encontrado nesta categoria.</p>
        )}
        
        {animaisFiltrados.map((animal) => (
          <div key={animal.id} className={`card card-${animal.tipo}`}>
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
                href={`https://wa.me/55${animal.contato.replace(/\D/g, '')}?text=Olá! Vi o anúncio no AdotaPet e gostaria de informações.`}
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

      {/* BOTÃO FLUTUANTE */}
      <button className="fab" onClick={() => setModalAberto(true)}>+</button>

      {/* MODAL DE CADASTRO */}
      {modalAberto && (
        <div className="overlay">
          <div className="modal-card">
            <button className="btn-fechar" onClick={fecharModal}>&times;</button>
            
            {passo === 1 ? (
              <div className="selecao-tipo">
                <h2>O que você deseja anunciar?</h2>
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
                  />
                </label>

                <input 
                  placeholder={novoPet.tipo === 'encontrado' ? "Seu Nome *" : "Nome da Pessoa *"} 
                  value={novoPet.nomePessoa}
                  onChange={(e) => setNovoPet({...novoPet, nomePessoa: e.target.value})} 
                  required 
                />
                
                {novoPet.tipo !== 'encontrado' && (
                  <input 
                    placeholder="Nome do Animal *" 
                    value={novoPet.nomeAnimal}
                    onChange={(e) => setNovoPet({...novoPet, nomeAnimal: e.target.value})} 
                    required 
                  />
                )}

                <div className="campo-group">
                  <label>Porte do Animal *</label>
                  <select value={novoPet.porte} onChange={(e) => setNovoPet({...novoPet, porte: e.target.value})} required>
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
                />

                {(novoPet.tipo === 'perdido' || novoPet.tipo === 'encontrado') && (
                  <div className="area-local">
                    <p className="aviso-local">*{novoPet.tipo === 'perdido' ? 'Último local visto' : 'Local que encontrei'}*</p>
                    <div className="row">
                      <input placeholder="Bairro *" value={novoPet.bairro} onChange={(e) => setNovoPet({...novoPet, bairro: e.target.value})} required />
                      <input placeholder="Referência *" value={novoPet.pontoReferencia} onChange={(e) => setNovoPet({...novoPet, pontoReferencia: e.target.value})} required />
                    </div>
                  </div>
                )}

                {novoPet.tipo === 'encontrado' && (
                  <textarea 
                    placeholder="Estado do animal (Ex: ferido, dócil, assustado...) *" 
                    value={novoPet.estadoAnimal}
                    onChange={(e) => setNovoPet({...novoPet, estadoAnimal: e.target.value})} 
                    required 
                  />
                )}

                <button type="submit" className="btn-enviar">Publicar Agora</button>
                <button type="button" onClick={() => setPasso(1)} className="btn-voltar">Voltar</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;