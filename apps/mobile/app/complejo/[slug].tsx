import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, RequestError, type ComplejoDetalle } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import { formatCLP } from "@/lib/format";

const DEPORTE_LABEL: Record<string, string> = { futbolito: "Fútbolito", futbol: "Fútbol", padel: "Pádel", tenis: "Tenis" };
const DIA_SEMANA_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function formatDiaChip(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return {
    dia: d.toLocaleDateString("es-CL", { weekday: "short" }).replace(".", ""),
    numero: d.getDate(),
  };
}

// Confirmación que se dispara justo después de reservar (no un botón aparte
// en otra pantalla) — así se pregunta en el momento en que de verdad se sabe
// si el equipo quedó completo o no.
type PendingConfirm = { reservaId: string; canchaNombre: string; fecha: string; hora: string; descuentoAplicado: boolean };

export default function ComplejoScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { usuario } = useSession();
  const [complejo, setComplejo] = useState<ComplejoDetalle | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<"red" | "no_existe" | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [reservando, setReservando] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [ligaEnCurso, setLigaEnCurso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { complejo } = await api.obtenerComplejo(slug);
      setComplejo(complejo);
      setErrorCarga(null);
      setDiaSeleccionado((actual) => actual ?? complejo.canchas[0]?.slots[0]?.fecha ?? null);
    } catch (e) {
      // Sin esto, un error de red al abrir la pantalla dejaba un spinner
      // girando para siempre — ni retry ni forma de saber qué pasó. Un 404
      // (el complejo no existe) es distinto de una falla de red: reintentar
      // ahí no tiene sentido, así que se distingue el mensaje.
      setErrorCarga(e instanceof RequestError && e.status === 404 ? "no_existe" : "red");
    } finally {
      setCargando(false);
    }
  }, [slug, usuario?.id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const dias = useMemo(() => {
    if (!complejo) return [];
    const set = new Set<string>();
    for (const c of complejo.canchas) for (const s of c.slots) set.add(s.fecha);
    return [...set].sort();
  }, [complejo]);

  async function onReservar(canchaId: string, canchaNombre: string, fecha: string, hora: string) {
    if (!usuario) return router.push("/login");
    setReservando(`${canchaId}-${hora}`);
    try {
      const r = await api.reservar(canchaId, fecha, hora);
      if (!r.ok || !r.reservaId) {
        const motivo = r.error === "ocupado" ? "Justo se ocupó ese horario." : r.error === "fecha_pasada" ? "Ese día ya pasó." : (r.error ?? "");
        Alert.alert("No se pudo reservar", motivo);
        await cargar();
        return;
      }
      await cargar();
      // En vez de un simple "listo", preguntamos ahí mismo si falta gente.
      setPendingConfirm({ reservaId: r.reservaId, canchaNombre, fecha, hora, descuentoAplicado: !!r.descuentoAplicado });
    } catch {
      // Sin este catch, un error de red acá quedaba como una promesa
      // rechazada sin atrapar: el botón se destrababa (por el finally) pero
      // el usuario nunca se enteraba de que la reserva no se hizo.
      Alert.alert("No se pudo reservar", "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setReservando(null);
    }
  }

  async function onNecesitaJugadores() {
    if (!usuario || !pendingConfirm) return;
    setEnviandoSolicitud(true);
    try {
      const r = await api.buscarRival(pendingConfirm.reservaId);
      if (r.ok) {
        setPendingConfirm(null);
        Alert.alert("Listo", "Avisamos que este partido busca jugadores — ya aparece en la pestaña Partidos.");
      } else {
        Alert.alert("No se pudo", r.error ?? "");
      }
    } catch {
      Alert.alert("No se pudo", "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnviandoSolicitud(false);
    }
  }

  async function onAnotarmeLiga(ligaId: string) {
    if (!usuario) return router.push("/login");
    setLigaEnCurso(ligaId);
    try {
      const r = await api.inscribirseALiga(ligaId);
      if (!r.ok) {
        const motivo =
          r.error === "sin_cupo" ? "Esa liga ya está completa." : r.error === "ya_inscrito" ? "Ya estabas anotado." : r.error === "pausada" ? "Esa liga está pausada." : (r.error ?? "");
        Alert.alert("No se pudo anotar", motivo);
      }
      await cargar();
    } catch {
      Alert.alert("No se pudo anotar", "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setLigaEnCurso(null);
    }
  }

  async function onSalirLiga(ligaId: string) {
    setLigaEnCurso(ligaId);
    try {
      const r = await api.salirDeLiga(ligaId);
      if (!r.ok) Alert.alert("No se pudo salir", r.error ?? "");
      await cargar();
    } catch {
      Alert.alert("No se pudo salir", "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setLigaEnCurso(null);
    }
  }

  if (!complejo) {
    if (errorCarga === "no_existe") {
      return (
        <View style={styles.center}>
          <Text style={styles.muted}>Este complejo ya no existe o cambió de dirección.</Text>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.seriesValle, marginTop: 12 }]} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
            <Text style={{ color: "white", fontWeight: "600" }}>Volver</Text>
          </Pressable>
        </View>
      );
    }
    if (errorCarga === "red") {
      return (
        <View style={styles.center}>
          <Text style={styles.muted}>No pudimos cargar este complejo.</Text>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.seriesValle, marginTop: 12 }]} onPress={cargar} disabled={cargando}>
            <Text style={{ color: "white", fontWeight: "600" }}>{cargando ? "Reintentando…" : "Reintentar"}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const canchasConSlotsDelDia = complejo.canchas.map((c) => ({
    ...c,
    libres: c.slots.filter((s) => s.fecha === diaSeleccionado && s.estado === "libre"),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <FlatList
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>{complejo.nombre}</Text>
              <View style={[styles.badge, { backgroundColor: complejo.requiereAbono ? colors.seriesValle : colors.statusGood, alignSelf: "flex-start" }]}>
                <Text style={styles.badgeText}>{complejo.requiereAbono ? `Exige abono del ${complejo.porcentajeAbono}%` : "Reserva sin pago online"}</Text>
              </View>
              <Text style={styles.subtitle}>
                {complejo.direccion}, {complejo.comuna}
              </Text>
              {!usuario ? (
                <Pressable onPress={() => router.push("/login")}>
                  <Text style={[styles.muted, { textDecorationLine: "underline", marginTop: 6 }]}>Iniciá sesión para reservar</Text>
                </Pressable>
              ) : null}
              {complejo.descuentoActivo ? (
                <View style={styles.descuentoBanner}>
                  <Text style={styles.descuentoBannerText}>🔥 Tu racha te da 15% de descuento en horarios valle acá.</Text>
                </View>
              ) : null}
            </View>

            {/* Calendario: elegís el día primero, todo lo de abajo depende de esto */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.diasRow}>
              {dias.map((fecha) => {
                const { dia, numero } = formatDiaChip(fecha);
                const activo = fecha === diaSeleccionado;
                return (
                  <Pressable key={fecha} onPress={() => setDiaSeleccionado(fecha)} style={[styles.diaChip, activo && { backgroundColor: colors.seriesValle, borderColor: colors.seriesValle }]}>
                    <Text style={[styles.diaChipDia, activo && { color: "white" }]}>{dia}</Text>
                    <Text style={[styles.diaChipNumero, activo && { color: "white" }]}>{numero}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {complejo.ligas.length > 0 ? (
              <View style={styles.ligasSection}>
                <Text style={styles.ligasTitulo}>Ligas recurrentes</Text>
                {complejo.ligas.map((liga) => {
                  const busy = ligaEnCurso === liga.id;
                  const completa = liga.cupoOcupado >= liga.cupoMaximo;
                  return (
                    <View key={liga.id} style={styles.ligaCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ligaNombre}>{liga.nombre}</Text>
                        <Text style={styles.muted}>
                          {liga.cancha.nombre} · {DEPORTE_LABEL[liga.cancha.deporte] ?? liga.cancha.deporte}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: completa ? colors.statusWarning : colors.seriesPrime, alignSelf: "flex-start", marginTop: 4 }]}>
                          <Text style={styles.badgeText}>
                            {DIA_SEMANA_LABEL[liga.diaSemana]} {liga.horaInicio.slice(0, 5)} · {liga.cupoOcupado}/{liga.cupoMaximo} anotados
                          </Text>
                        </View>
                      </View>
                      {liga.inscrito ? (
                        <Pressable disabled={busy} style={[styles.actionBtn, { backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline }]} onPress={() => onSalirLiga(liga.id)}>
                          <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{busy ? "..." : "Salir"}</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          disabled={busy || completa}
                          style={[styles.actionBtn, { backgroundColor: colors.seriesPrime, opacity: completa ? 0.5 : 1 }]}
                          onPress={() => onAnotarmeLiga(liga.id)}
                        >
                          <Text style={{ color: "white", fontWeight: "600" }}>{busy ? "..." : "Anotarme"}</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        }
        data={canchasConSlotsDelDia}
        keyExtractor={(c) => c.id}
        renderItem={({ item: cancha }) => (
          <View style={styles.canchaCard}>
            <View style={styles.canchaHeaderRow}>
              <Text style={styles.canchaNombre}>
                {cancha.nombre} <Text style={styles.muted}>· {DEPORTE_LABEL[cancha.deporte] ?? cancha.deporte}</Text>
              </Text>
              <Text style={styles.precio}>
                {formatCLP(cancha.precioBase)}/h{complejo.descuentoActivo ? <Text style={{ color: colors.seriesPrime }}> · -15% valle</Text> : null}
              </Text>
            </View>
            {cancha.libres.length === 0 ? (
              <Text style={styles.muted}>Sin horarios libres este día</Text>
            ) : (
              <View style={styles.horasRow}>
                {cancha.libres.map((slot) => {
                  const busy = reservando === `${cancha.id}-${slot.hora}`;
                  return (
                    <Pressable
                      key={slot.hora}
                      disabled={busy}
                      style={[styles.horaChip, slot.valle && styles.horaChipValle, busy && { opacity: 0.6 }]}
                      onPress={() => onReservar(cancha.id, cancha.nombre, slot.fecha, slot.hora)}
                    >
                      <Text style={[styles.horaChipText, slot.valle && { color: "white" }]}>{busy ? "..." : slot.hora}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      {/* Se pregunta apenas se reserva, no en otra pantalla aparte */}
      <Modal visible={!!pendingConfirm} transparent animationType="fade" onRequestClose={() => setPendingConfirm(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¡Reserva confirmada!{pendingConfirm?.descuentoAplicado ? " 🔥" : ""}</Text>
            {pendingConfirm?.descuentoAplicado ? <Text style={[styles.muted, { textAlign: "center", color: colors.seriesPrime }]}>Con 15% de descuento por tu racha</Text> : null}
            <Text style={styles.modalSubtitle}>
              {pendingConfirm?.canchaNombre} · {pendingConfirm && formatDiaChip(pendingConfirm.fecha).numero}/{pendingConfirm?.hora}
            </Text>
            <Text style={styles.modalPregunta}>¿Tenés los equipos completos, o te faltan jugadores?</Text>
            <Pressable disabled={enviandoSolicitud} style={[styles.modalBtn, { backgroundColor: colors.seriesPrime }]} onPress={onNecesitaJugadores}>
              <Text style={styles.modalBtnText}>{enviandoSolicitud ? "..." : "Me faltan jugadores"}</Text>
            </Pressable>
            <Pressable style={[styles.modalBtn, { backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline }]} onPress={() => setPendingConfirm(null)}>
              <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Estamos completos</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.page },
  header: { padding: 16, gap: 4, backgroundColor: colors.page },
  title: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  muted: { fontSize: 12, color: colors.textMuted },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, marginTop: 4 },
  badgeText: { color: "white", fontSize: 11, fontWeight: "600" },
  descuentoBanner: { marginTop: 10, borderRadius: 10, padding: 10, backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline },
  descuentoBannerText: { fontSize: 12, color: colors.textPrimary, fontWeight: "600" },

  diasRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },

  ligasSection: { paddingHorizontal: 16, paddingBottom: 4, gap: 8 },
  ligasTitulo: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  ligaCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gridline,
  },
  ligaNombre: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },

  diaChip: { width: 52, paddingVertical: 8, borderRadius: 12, alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gridline },
  diaChipDia: { fontSize: 11, color: colors.textMuted, textTransform: "capitalize" },
  diaChipNumero: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },

  canchaCard: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gridline },
  canchaHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  canchaNombre: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  precio: { fontSize: 12, color: colors.textSecondary },
  horasRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horaChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.chartSurface, borderWidth: 1, borderColor: colors.gridline },
  horaChipValle: { backgroundColor: colors.seriesValle, borderColor: colors.seriesValle },
  horaChipText: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: "100%", maxWidth: 360, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
  modalSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginBottom: 6 },
  modalPregunta: { fontSize: 14, color: colors.textPrimary, textAlign: "center", marginBottom: 4, fontWeight: "600" },
  modalBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { color: "white", fontWeight: "600", fontSize: 14 },
});
