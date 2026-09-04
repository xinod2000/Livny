(* =========================================================================
   ПРОЕКТ    : Весовой дозатор сахара в мешки 25/50 кг («Ливны»)
   ПЛАТФОРМА : ОВЕН СПК107 · CODESYS 3.5.17 · IEC 61131-3 (Structured Text)
   =========================================================================
   ФАЙЛ      : 06_FB_AlarmManager.st
   НАЗНАЧЕНИЕ: Централизованная обработка аварий.
               - событийные аварии (затор, передоз, сбой тары…) —
                 с самоблокировкой: сбрасываются только КВИТИРОВАНИЕМ;
               - непрерывные условия (аварийный стоп, связь, воздух,
                 уровень, крышка) — отображаются «вживую»;
               - мигалка 1 Гц для сигнальной лампы.
   ========================================================================= *)

FUNCTION_BLOCK FB_AlarmManager

VAR_INPUT
    (* Живые уровни *)
    xEStop       : BOOL;   (* аварийный стоп (НЗ-цепь разомкнута)        *)
    xCommLoss    : BOOL;   (* нет связи с МВ110-224.1ТД                  *)
    xAirOK       : BOOL;   (* давление пневмосети в норме                *)
    xLevelOK     : BOOL;   (* уровень продукта в норме                   *)
    xCoverClosed : BOOL;   (* защитная крышка закрыта                    *)

    (* Импульсные запросы от FB_DoserControl (защёлкиваются) *)
    xReqTareFault  : BOOL;
    xReqNoFlow     : BOOL;
    xReqOverdose   : BOOL;
    xReqUnderdose  : BOOL;
    xReqClamp      : BOOL;

    (* Квитирование оператором (импульс с экрана/кнопки) *)
    xAckAll      : BOOL;
END_VAR

VAR_OUTPUT
    stA        : ST_Alarms; (* структура для HMI и журнала              *)
    xActiveAny : BOOL;      (* есть активная авария                     *)
    xLampBlink : BOOL;      (* мигающий сигнал 1 Гц при аварии          *)
END_VAR

VAR
    tonBlink : TON;          (* генератор мигания                       *)
END_VAR

(* ---------------------------------------------------------------------
   1. СОБЫТИЙНЫЕ АВАРИИ С САМОБЛОКИРОВКОЙ:
      alarm := request OR (alarm AND NOT ack)
   --------------------------------------------------------------------- *)
stA.xTareFault  := xReqTareFault OR (stA.xTareFault  AND NOT xAckAll);
stA.xNoFlow     := xReqNoFlow    OR (stA.xNoFlow     AND NOT xAckAll);
stA.xOverdose   := xReqOverdose  OR (stA.xOverdose   AND NOT xAckAll);
stA.xUnderdose  := xReqUnderdose OR (stA.xUnderdose  AND NOT xAckAll);
stA.xClampFault := xReqClamp     OR (stA.xClampFault AND NOT xAckAll);

(* ---------------------------------------------------------------------
   2. НЕПРЕРЫВНЫЕ УСЛОВИЯ — индицируются, пока причина не устранена.
   --------------------------------------------------------------------- *)
stA.xEStop    := xEStop;
stA.xCommLoss := xCommLoss;
stA.xAirLow   := NOT xAirOK;
stA.xLevelLow := NOT xLevelOK;
stA.xCoverOpen:= NOT xCoverClosed;

(* ---------------------------------------------------------------------
   3. ОБОБЩЁННЫЙ ПРИЗНАК И МИГАЛКА (1 ГЦ, скважность 2).
   --------------------------------------------------------------------- *)
xActiveAny := stA.xEStop    OR stA.xCommLoss  OR stA.xTareFault
           OR stA.xNoFlow   OR stA.xOverdose  OR stA.xUnderdose
           OR stA.xClampFault OR stA.xAirLow  OR stA.xLevelLow
           OR stA.xCoverOpen;

stA.xActive := xActiveAny;

(* Самоперезапускающийся таймер: Q=0.5с / пауза 0.5с → 1 Гц *)
tonBlink(IN := NOT tonBlink.Q, PT := T#500MS);
xLampBlink := tonBlink.Q AND xActiveAny;

END_FUNCTION_BLOCK

(* =========================================================================
   КОНЕЦ ФАЙЛА 06_FB_AlarmManager.st
   ========================================================================= *)
