
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, Clock, CheckCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const colors = {
  bg: '#0a0a12',
  bgCard: 'rgba(255, 255, 255, 0.03)',
  green: '#22c55e',
  blue: '#3b82f6',
  white: '#ffffff',
  white60: 'rgba(255, 255, 255, 0.6)',
  white40: 'rgba(255, 255, 255, 0.4)',
  white20: 'rgba(255, 255, 255, 0.2)',
  white10: 'rgba(255, 255, 255, 0.1)',
};

export default function DisparoPage() {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [delay, setDelay] = useState("30");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Fetch Devices
  const { data: devices } = useQuery<any[]>({
    queryKey: ['/api/devices'],
  });

  // Fetch Contacts when device is selected
  const { data: contacts, isLoading: loadingContacts } = useQuery<any[]>({
    queryKey: ['/api/whatsapp/contacts', selectedDevice],
    enabled: !!selectedDevice,
  });

  useEffect(() => {
    if (devices && devices.length > 0 && !selectedDevice) {
      const connected = devices.find(d => d.connectionStatus === 'connected');
      if (connected) setSelectedDevice(connected.id);
    }
  }, [devices]);

  useEffect(() => {
    if (selectAll && contacts) {
      setSelectedContacts(contacts.map(c => c.number));
    } else {
      setSelectedContacts([]);
    }
  }, [selectAll, contacts]);

  const createBroadcastMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: campaignName,
        deviceId: selectedDevice,
        message: message,
        contacts: selectedContacts,
        delay: parseInt(delay),
        startTime,
        endTime,
        daysOfWeek: selectedDays
      };
      console.log("Sending payload:", payload);
      return await apiRequest("POST", "/api/broadcasts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({ title: "Campanha agendada com sucesso! 🚀" });
      setCampaignName("");
      setMessage("");
      setSelectedContacts([]);
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar campanha",
        description: "Verifique se preencheu todos os campos.",
        variant: "destructive"
      });
      console.error(error);
    }
  });

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const toggleContact = (number: string) => {
    if (selectedContacts.includes(number)) {
      setSelectedContacts(selectedContacts.filter(n => n !== number));
    } else {
      setSelectedContacts([...selectedContacts, number]);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', borderRadius: '10px',
    border: `1px solid ${colors.white20}`, background: 'rgba(255, 255, 255, 0.05)',
    color: colors.white, fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, padding: '24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" className="mb-4 inline-block" style={{ color: colors.white40, textDecoration: 'none' }}>← Voltar</Link>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: colors.white, margin: '16px 0 8px' }}>Agente de Disparo</h1>
        <p style={{ color: colors.white60, marginBottom: '32px' }}>Configure campanhas de disparo automático com agendamento inteligente.</p>

        <div style={{ background: colors.bgCard, border: `1px solid ${colors.white10}`, borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>

          {/* Dispositivo */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.white60, fontSize: '14px', marginBottom: '8px' }}>Dispositivo Conectado</label>
            <select
              value={selectedDevice}
              onChange={e => setSelectedDevice(e.target.value)}
              style={{ ...inputStyle, background: '#1e1e24' }}
            >
              <option value="">Selecione um dispositivo</option>
              {devices?.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.connectionStatus === 'connected' ? '🟢 Online' : '🔴 Offline'})
                </option>
              ))}
            </select>
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: colors.white, marginBottom: '20px' }}>Configuração da Campanha</h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.white60, fontSize: '14px', marginBottom: '8px' }}>Nome da campanha</label>
            <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ex: Black Friday 2026" style={inputStyle} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.white60, fontSize: '14px', marginBottom: '8px' }}>Mensagem</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Digite sua mensagem aqui..."
              style={{ ...inputStyle, minHeight: '100px', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.white60, fontSize: '14px', marginBottom: '8px' }}>Delay entre mensagens (segundos)</label>
            <input type="number" value={delay} onChange={e => setDelay(e.target.value)} style={{ ...inputStyle, maxWidth: '200px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', color: colors.white60, fontSize: '14px', marginBottom: '8px' }}>Horário início</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', color: colors.white60, fontSize: '14px', marginBottom: '8px' }}>Horário fim</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', color: colors.white60, fontSize: '14px', marginBottom: '12px' }}>Dias da semana</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, i) => (
                <button key={i}
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px',
                    background: selectedDays.includes(day) ? colors.blue : 'transparent',
                    border: `1px solid ${selectedDays.includes(day) ? colors.blue : colors.white20}`,
                    color: colors.white, fontSize: '14px', cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de Contatos */}
          <div style={{ marginBottom: '24px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ color: colors.white, fontWeight: 600 }}>Contatos ({selectedContacts.length})</h3>
              <button
                onClick={() => setSelectAll(!selectAll)}
                style={{ color: colors.blue, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {selectAll ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            {loadingContacts ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin text-white" /></div>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {contacts?.map(contact => (
                  <div key={contact.id} className="flex items-center gap-2 p-2 hover:bg-white/5 rounded">
                    <Checkbox
                      checked={selectedContacts.includes(contact.number)}
                      onCheckedChange={() => toggleContact(contact.number)}
                    />
                    <span className="text-sm text-gray-300">{contact.name || contact.number}</span>
                    <span className="text-xs text-gray-500 ml-auto">{contact.number}</span>
                  </div>
                ))}
                {(!contacts || contacts.length === 0) && (
                  <p className="text-gray-500 text-sm text-center">Nenhum contato encontrado no WhatsApp.</p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => createBroadcastMutation.mutate()}
            disabled={createBroadcastMutation.isPending || !selectedDevice || !message || selectedContacts.length === 0}
            style={{
              width: '100%',
              padding: '14px 28px', borderRadius: '10px', border: 'none',
              background: `linear-gradient(135deg, ${colors.blue}, #2563eb)`,
              color: colors.white, fontWeight: 600, cursor: 'pointer',
              opacity: (createBroadcastMutation.isPending || !selectedDevice) ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}>
            {createBroadcastMutation.isPending ? <Loader2 className="animate-spin" /> : '🚀 Iniciar Campanha'}
          </button>
        </div>

        {/* Lista de Campanhas Recentes (Simplificada) */}
        <div style={{ marginTop: '40px' }}>
          <h3 style={{ color: colors.white, fontSize: '20px', marginBottom: '16px' }}>Campanhas Recentes</h3>
          {/* Aqui poderia entrar uma lista das campanhas já criadas */}
        </div>
      </div>
    </div>
  );
}
