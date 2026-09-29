import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, SesionInvalidaError, type MiRacha, type MiReserva, type ReservaParaReportar, type RivalHistorial } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import { formatCLP, formatHora } from "@/lib/format";

const DEPORTE_LABEL: Record<string, string> = { futbolito: "Fútbolito", futbol: "Fútbol", padel: "Pádel", tenis: "Tenis" };
const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente de pago",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No-show",
};

function formatFechaCorta(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}

// Un jugador activo puede acumular decenas de partidos pasados — mostrarlos
// todos de una hace que esta pantalla sea puro scroll sin fin. Solo los
// primeros quedan visibles hasta que se pida ver el resto.
const LIMITE_HISTORIAL_INICIAL = 10;

export default function MisReservasScreen() {
  const router = useRouter();
  const { usuario } = useSession();
  const [reservas, setReservas] = useState<MiReserva[] | null>(null);
  const [rachas, setRachas] = useState<MiRacha[]>([]);
  const [rivales, setRivales] = useState<RivalHistorial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [verTodoHistorial, setVerTodoHistorial] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [modalReservaId, setModalReservaId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<ReservaParaReportar | null>(null);
  const [modalCargando, setModalCargando] = useState(false);
  const [modalEquipos, setModalEquipos] = useState<Record<string, "A" | "B">>({});
  const [modalGanador, setModalGanador] = useState<"A" | "B" | "empate">("A");
  const [modalEnviando, setModalEnviando] = useState(false);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    try {
      const { reservas, rachas, rivales } = await api.misReservas();
      setReservas(reservas);
      setRachas(rachas);
      setRivales(rivales);
      setErrorCarga(false);
    } catch (e) {
      // Sesión inválida: lib/session.tsx ya la cerró sola (el usuario va a
      // ver la pantalla de "iniciá sesión" apenas cambie ese estado). Otros
      // errores de red sí los mostramos, y dejan de mostrar el spinner de
      // "vacio" girando para siempre (antes se quedaba así hasta que se
      // hiciera pull-to-refresh, sin ninguna pista de que había fallado).
      if (!(e instanceof SesionInvalidaError)) {
        Alert.alert("No se pudo cargar", "Revisá tu conexión e intentá de nuevo.");
        setErrorCarga(true);
      }
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (!usuario) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Iniciá sesión para ver tus reservas.</Text>
        <Pressable onPress={() => router.push("/login")} style={[styles.actionBtn, { backgroundColor: colors.seriesValle, marginTop: 12 }]}>
          <Text style={styles.actionBtnText}>Iniciar sesión</Text>
        </Pressable>
      </View>
    );
  }

  async function onCancelar(id: string) {
    if (!usuario) return;
    setEnCurso(id);
    try {
      const r = await api.cancelarReserva(id);
      if (!r.ok) Alert.alert("No se pudo cancelar", r.error ?? "");
      else {
        Alert.alert("Listo", "Reserva cancelada.");
        await cargar();
      }
    } catch {
      Alert.alert("No se pudo cancelar", "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnCurso(null);
    }
  }

  async function onBuscarRival(id: string) {
    if (!usuario) return;
    setEnCurso(id);
    try {
      const r = await api.buscarRival(id);
      if (!r.ok) Alert.alert("No se pudo", r.error ?? "");
      else {
        Alert.alert("Listo", "Avisamos que buscás rival para ese partido.");
        await cargar();
      }
    } catch {
      Alert.alert("No se pudo", "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnCurso(null);
    }
  }

  async function onInvitarRival(solicitudId: string, rivalId: string, rivalNombre: string) {
    setEnCurso(solicitudId);
    try {
      const r = await api.invitarRival(solicitudId, rivalId);
      if (!r.ok) Alert.alert("No se pudo invitar", r.error ?? "");
      else Alert.alert("Listo", `Le mandamos la invitación a ${rivalNombre}.`);
    } catch {
      Alert.alert("No se pudo invitar", "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnCurso(null);
    }
  }

  async function abrirReportar(reservaId: string) {
    setModalReservaId(reservaId);
    setModalCargando(true);
    setModalData(null);
    setModalGanador("A");
    try {
      const { reserva } = await api.obtenerParticipantesReserva(reservaId);
      setModalData(reserva);
      setModalEquipos(Object.fromEntries(reserva.participantes.map((p) => [p.usuarioId, "A" as const])));
    } catch {
      Alert.alert("No se pudo cargar", "Revisá tu conexión e intentá de nuevo.");
      setModalReservaId(null);
    } finally {
      setModalCargando(false);
    }
  }

  async function enviarResultado() {
    if (!modalReservaId || !modalData) return;
    setModalEnviando(true);
    try {
      const asignaciones = modalData.participantes.map((p) => ({ usuarioId: p.usuarioId, equipo: modalEquipos[p.usuarioId] ?? "A" }));
      const r = await api.reportarResultado(modalReservaId, modalGanador, asignaciones);
      if (!r.ok) {
        Alert.alert("No se pudo reportar", r.error ?? "");
        return;
      }
      setModalReservaId(null);
      Alert.alert("Listo", "Resultado reportado — el nivel se actualizó.");
      await cargar();
    } catch {
      Alert.alert("No se pudo reportar", "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setModalEnviando(false);
    }
  }

  const hoyISO = new Date().toISOString().slice(0, 10);
  const proximas = (reservas ?? []).filter((r) => r.fecha >= hoyISO && r.estado !== "cancelada");
  const pasadas = (reservas ?? []).filter((r) => r.fecha < hoyISO || r.estado === "cancelada");
  const pasadasVisibles = verTodoHistorial ? pasadas : pasadas.slice(0, LIMITE_HISTORIAL_INICIAL);
  const ocultas = pasadas.length - pasadasVisibles.length;

  return (
    <>
    <FlatList
      style={{ backgroundColor: colors.page }}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      data={[
        ...(rachas.length > 0 ? [{ tipo: "racha-header" as const }, ...rachas.map((r) => ({ tipo: "racha" as const, r }))] : []),
        { tipo: "header" as const },
        ...(proximas.length === 0 ? [{ tipo: "vacio" as const }] : proximas.map((r) => ({ tipo: "reserva" as const, r, accionable: true }))),
        ...(pasadas.length > 0 ? [{ tipo: "historial-header" as const }, ...pasadasVisibles.map((r) => ({ tipo: "reserva" as const, r, accionable: false }))] : []),
        ...(ocultas > 0 ? [{ tipo: "ver-mas" as const, cantidad: ocultas }] : []),
      ]}
      keyExtractor={(item, i) => (item.tipo === "reserva" ? item.r.id : item.tipo === "racha" ? `racha-${item.r.complejoSlug}` : `${item.tipo}-${i}`)}
      renderItem={({ item }) => {
        if (item.tipo === "racha-header") return <Text style={styles.sectionTitle}>Tu racha</Text>;
        if (item.tipo === "ver-mas") {
          return (
            <Pressable style={styles.verMasBtn} onPress={() => setVerTodoHistorial(true)}>
              <Text style={styles.verMasTexto}>Ver los {item.cantidad} partidos anteriores</Text>
            </Pressable>
          );
        }
        if (item.tipo === "racha") {
          const r = item.r;
          return (
            <View style={[styles.card, !r.vigente && { opacity: 0.6 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <Text style={styles.cardTitle}>
                    🔥 {r.contadorActual} semana{r.contadorActual === 1 ? "" : "s"} seguidas
                  </Text>
                  <Text style={styles.muted}>{r.complejoNombre}</Text>
                </View>
                {r.recompensaDesbloqueada ? <Chip text="Recompensa" bg={colors.statusGood} /> : null}
              </View>
              <Text style={[styles.muted, !r.vigente && { color: "#d03b3b" }]}>
                {r.vigente ? `Mejor racha: ${r.mejorRacha}` : `Se corta si no jugás esta semana — mejor racha: ${r.mejorRacha}`}
              </Text>
            </View>
          );
        }
        if (item.tipo === "header") return <Text style={styles.sectionTitle}>Próximas</Text>;
        if (item.tipo === "historial-header") return <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Historial</Text>;
        if (item.tipo === "vacio") {
          if (errorCarga) return <Text style={styles.muted}>No pudimos cargar tus reservas — deslizá hacia abajo para reintentar.</Text>;
          if (!reservas) return <ActivityIndicator style={{ marginVertical: 24 }} />;
          return <Text style={styles.muted}>Todavía no tenés partidos agendados.</Text>;
        }

        const { r, accionable } = item;
        const busy = enCurso === r.id;
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{r.complejo.nombre}</Text>
            <Text style={styles.muted}>
              {r.cancha.nombre} · {DEPORTE_LABEL[r.cancha.deporte] ?? r.cancha.deporte}
            </Text>
            <View style={styles.badgeRow}>
              <Text style={styles.rowText}>{formatFechaCorta(r.fecha)}</Text>
              <Text style={styles.rowText}>{formatHora(r.horaInicio)}–{formatHora(r.horaFin)}</Text>
              {r.esHorarioValle ? <Chip text="Horario valle" bg={colors.seriesValle} /> : null}
              {!r.esOrganizador ? <Chip text="Te uniste" bg={colors.statusGood} /> : null}
              <Chip text={ESTADO_LABEL[r.estado] ?? r.estado} bg={colors.textMuted} />
            </View>
            {r.montoAbono > 0 ? (
              <Text style={styles.muted}>
                Abono pagado: {formatCLP(r.montoAbono)} de {formatCLP(r.montoTotal)}
              </Text>
            ) : null}
            {(accionable && r.esOrganizador && r.estado !== "cancelada") || r.puedeReportarResultado ? (
              <View style={styles.actionsRow}>
                {accionable && r.esOrganizador && r.estado !== "cancelada" ? (
                  <>
                    {r.puedeBuscarRival ? (
                      <Pressable disabled={busy} style={[styles.actionBtn, { backgroundColor: colors.seriesPrime, opacity: busy ? 0.6 : 1 }]} onPress={() => onBuscarRival(r.id)}>
                        <Text style={styles.actionBtnText}>Buscar rival</Text>
                      </Pressable>
                    ) : r.solicitudAbiertaId ? (
                      <Chip text="Ya buscando rival" bg={colors.statusWarning} />
                    ) : null}
                    <Pressable disabled={busy} style={[styles.actionBtn, { backgroundColor: "#d03b3b", opacity: busy ? 0.6 : 1 }]} onPress={() => onCancelar(r.id)}>
                      <Text style={styles.actionBtnText}>Cancelar</Text>
                    </Pressable>
                  </>
                ) : null}
                {r.puedeReportarResultado ? (
                  <Pressable style={[styles.actionBtn, { backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline }]} onPress={() => abrirReportar(r.id)}>
                    <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Reportar resultado</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {r.solicitudAbiertaId && rivales.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.muted, { marginBottom: 4 }]}>Desafiar directo a un rival anterior:</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {rivales.slice(0, 5).map((riv) => {
                    const invitando = enCurso === r.solicitudAbiertaId;
                    return (
                      <Pressable
                        key={riv.rivalId}
                        disabled={invitando}
                        style={[styles.actionBtn, { backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline, opacity: invitando ? 0.6 : 1 }]}
                        onPress={() => onInvitarRival(r.solicitudAbiertaId!, riv.rivalId, riv.rivalNombre)}
                      >
                        <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
                          {riv.rivalNombre} ({riv.victorias}V {riv.empates}E {riv.derrotas}D)
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        );
      }}
    />

    <Modal visible={!!modalReservaId} transparent animationType="fade" onRequestClose={() => setModalReservaId(null)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {modalCargando || !modalData ? (
            <ActivityIndicator />
          ) : (
            <ScrollView>
              <Text style={styles.modalTitle}>Reportar resultado</Text>
              <Text style={[styles.muted, { textAlign: "center", marginBottom: 4 }]}>
                {modalData.complejo.nombre} · {modalData.cancha.nombre}
              </Text>
              <Text style={[styles.muted, { textAlign: "center", marginBottom: 12 }]}>
                Sin verificar con el rival — queda fijo una vez cargado.
              </Text>

              {modalData.participantes.length < 2 ? (
                <Text style={[styles.muted, { textAlign: "center" }]}>No hubo suficientes jugadores anotados para armar dos equipos.</Text>
              ) : (
                <>
                  <Text style={styles.modalSectionTitle}>Equipos</Text>
                  {modalData.participantes.map((p) => (
                    <View key={p.usuarioId} style={styles.equipoRow}>
                      <Text style={styles.equipoNombre}>{p.nombre}</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {(["A", "B"] as const).map((eq) => (
                          <Pressable
                            key={eq}
                            style={[styles.pill, modalEquipos[p.usuarioId] === eq && { backgroundColor: colors.seriesValle, borderColor: colors.seriesValle }]}
                            onPress={() => setModalEquipos((prev) => ({ ...prev, [p.usuarioId]: eq }))}
                          >
                            <Text style={[styles.pillText, modalEquipos[p.usuarioId] === eq && { color: "white" }]}>{eq}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}

                  <Text style={styles.modalSectionTitle}>¿Quién ganó?</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                    {(["A", "B", "empate"] as const).map((g) => (
                      <Pressable key={g} style={[styles.pill, { flex: 1 }, modalGanador === g && { backgroundColor: colors.seriesPrime, borderColor: colors.seriesPrime }]} onPress={() => setModalGanador(g)}>
                        <Text style={[styles.pillText, { textAlign: "center" }, modalGanador === g && { color: "white" }]}>{g === "empate" ? "Empate" : `Equipo ${g}`}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable disabled={modalEnviando} style={[styles.modalBtn, { backgroundColor: colors.seriesValle }]} onPress={enviarResultado}>
                    <Text style={styles.modalBtnText}>{modalEnviando ? "..." : "Reportar resultado"}</Text>
                  </Pressable>
                </>
              )}
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline, marginTop: 8 }]} onPress={() => setModalReservaId(null)}>
                <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancelar</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}

function Chip({ text, bg }: { text: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.page, padding: 16 },
  muted: { fontSize: 13, color: colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.gridline, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 },
  rowText: { fontSize: 12, color: colors.textSecondary },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  chipText: { color: "white", fontSize: 11, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { color: "white", fontSize: 12, fontWeight: "600" },
  verMasBtn: { alignItems: "center", paddingVertical: 12 },
  verMasTexto: { color: colors.seriesValle, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: "100%", maxWidth: 360, maxHeight: "80%" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
  modalSectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginTop: 8, marginBottom: 8 },
  modalBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { color: "white", fontWeight: "600", fontSize: 14 },
  equipoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  equipoNombre: { fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.gridline, backgroundColor: colors.chartSurface },
  pillText: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
});
