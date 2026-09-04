(* =========================================================================
   ПРОЕКТ    : Весовой дозатор сахара в мешки 25/50 кг («Ливны»)
   ПЛАТФОРМА : ОВЕН СПК107 · CODESYS 3.5.17 · IEC 61131-3 (Structured Text)
   =========================================================================
   ФАЙЛ      : 07_PRG_Main.st
   НАЗНАЧЕНИЕ: Главная программа (PRG). Собирает контур управления:
               FB_InputHandler → FB_WeightChannel → FB_DoserControl
               → FB_AlarmManager, плюс режим РУЧНОЙ для пусконаладки.

               Размещается в основной задаче СПК107 (цикл 10…20 мс).
   ========================================================================= *)

PROGRAM PRG_Main

VAR
    fbIn   : FB_InputHandler;   (* антидребезг входов                    *)
    fbW    : FB_WeightChannel;  (* весовой канал                         *)
    fbDose : FB_DoserControl;   (* автомат дозирования                   *)
    fbAlm  : FB_AlarmManager;   (* аварии                                *)

    (* Фронты экранных кнопок СПК107 *)
    rtHmiStart : R_TRIG;
    rtHmiStop  : R_TRIG;
    rtHmiAck   : R_TRIG;
    rtHmiTare  : R_TRIG;

    xCmdStart : BOOL;   (* объединённый ПУСК: кнопка на щите ИЛИ экран  *)
    xCmdStop  : BOOL;   (* объединённый СТОП                            *)
    xCmdAck   : BOOL;   (* объединённое квитирование                    *)
END_VAR

(* ---------------------------------------------------------------------
   1. ОБРАБОТКА ДИСКРЕТНЫХ ВХОДОВ (антидребезг 40 мс, фронты кнопок)
   --------------------------------------------------------------------- *)
fbIn(
    xRawStart       := g_xDiStart,
    xRawStop        := g_xDiStop,
    xRawEStop       := g_xDiEStop,
    xRawBag         := g_xDiBagPresent,
    xRawClampClosed := g_xDiClampClosed,
    xRawAirOK       := g_xDiAirOK,
    xRawLevel       := g_xDiLevelOK,
    xRawCover       := g_xDiCoverClosed
);

(* ---------------------------------------------------------------------
   2. КОМАНДЫ УПРАВЛЕНИЯ: аппаратные кнопки + экран СПК107
   --------------------------------------------------------------------- *)
rtHmiStart(CLK := g_xHmiStart);
rtHmiStop (CLK := g_xHmiStop);
rtHmiAck  (CLK := g_xHmiAck);
rtHmiTare (CLK := g_xHmiTare);

xCmdStart := fbIn.xStartUp OR rtHmiStart.Q;
xCmdStop  := fbIn.xStopUp  OR rtHmiStop.Q;
xCmdAck   := rtHmiAck.Q;

(* ---------------------------------------------------------------------
   3. ВЕСОВОЙ КАНАЛ (фильтр, стабильность, тара, скорость потока)
   --------------------------------------------------------------------- *)
fbW(
    rWeightRaw  := g_rWeightRaw,
    xValid      := g_xWeightValid,
    xError      := g_xWeightErr,
    xTareCmd    := fbDose.xTareReq,
    xTareManual := rtHmiTare.Q OR g_Manual.xTare,
    rStabBand   := g_Params.rStabBand,
    tStabTime   := g_Params.tStabTime
);

(* обработанные данные — в глобальную структуру *)
g_Weight.rNet      := fbW.rNet;
g_Weight.rGross    := fbW.rGross;
g_Weight.rTare     := fbW.rTare;
g_Weight.xStable   := fbW.xStable;
g_Weight.rFlowRate := fbW.rFlowRate;
g_Weight.xCommOK   := fbW.xCommOK;

(* аппаратная установка нуля в МВ110-224.1ТД *)
g_xTareToModule := fbW.xTarePulse;

(* ---------------------------------------------------------------------
   4. УПРАВЛЕНИЕ: АВТОМАТ ИЛИ РУЧНОЙ РЕЖИМ
   --------------------------------------------------------------------- *)
IF g_xManualMode THEN
    (* РУЧНОЙ РЕЖИМ (пусконаладка/обслуживание):
       прямое управление выходами с экрана, с аппаратными блокировками. *)
    g_xDoClamp  := g_Manual.xClamp  AND fbIn.xAirOK AND NOT fbIn.xEStop;
    g_xDoCoarse := g_Manual.xCoarse AND NOT fbIn.xEStop AND fbIn.xCoverClosed;
    g_xDoFine   := g_Manual.xFine   AND NOT fbIn.xEStop AND fbIn.xCoverClosed;
    g_xDoSignal := g_Manual.xSignal;
    g_eState    := ST_STOP;               (* автомат остановлен       *)

ELSE
    (* АВТОМАТИЧЕСКИЙ РЕЖИМ *)
    fbDose(
        xEnable      := NOT g_xManualMode,
        xAlarmActive := fbAlm.xActiveAny,
        xStartCmd    := xCmdStart,
        xStopCmd     := xCmdStop,
        xAckCmd      := xCmdAck,

        rNet    := fbW.rNet,
        xStable := fbW.xStable,
        xCommOK := fbW.xCommOK,

        xBagPresent  := fbIn.xBagPresent,
        xClampClosed := fbIn.xClampClosed,
        xAirOK       := fbIn.xAirOK,
        xLevelOK     := fbIn.xLevelOK,
        xCoverClosed := fbIn.xCoverClosed,
        xEStop       := fbIn.xEStop,

        p       := g_Params,
        stStats := g_Stats
    );

    g_xDoClamp  := fbDose.xDoClamp;
    g_xDoCoarse := fbDose.xDoCoarse;
    g_xDoFine   := fbDose.xDoFine;
    g_eState    := fbDose.eState;
END_IF

(* ---------------------------------------------------------------------
   5. АВАРИИ: сбор запросов, защёлкивание, мигалка
   --------------------------------------------------------------------- *)
fbAlm(
    xEStop         := fbIn.xEStop,
    xCommLoss      := NOT fbW.xCommOK,
    xAirOK         := fbIn.xAirOK,
    xLevelOK       := fbIn.xLevelOK,
    xCoverClosed   := fbIn.xCoverClosed,
    xReqTareFault  := fbDose.xReqTareFault,
    xReqNoFlow     := fbDose.xReqNoFlow,
    xReqOverdose   := fbDose.xReqOverdose,
    xReqUnderdose  := fbDose.xReqUnderdose,
    xReqClamp      := fbDose.xReqClamp,
    xAckAll        := xCmdAck
);

g_Alarms := fbAlm.stA;

(* ---------------------------------------------------------------------
   6. СИГНАЛЬНАЯ ЛАМПА (в авто-режиме):
      авария — мигание 1 Гц; дозирование — ровный свет; простой — выкл.
   --------------------------------------------------------------------- *)
IF NOT g_xManualMode THEN
    IF g_Alarms.xActive THEN
        g_xDoSignal := fbAlm.xLampBlink;
    ELSIF (g_eState <> ST_STOP) AND (g_eState <> ST_READY) THEN
        g_xDoSignal := TRUE;
    ELSE
        g_xDoSignal := FALSE;
    END_IF
END_IF

END_PROGRAM

(* =========================================================================
   КОНЕЦ ФАЙЛА 07_PRG_Main.st
   ========================================================================= *)
