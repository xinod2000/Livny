(* =========================================================================
   ПРОЕКТ    : Весовой дозатор сахара в мешки 25/50 кг («Ливны»)
   ПЛАТФОРМА : ОВЕН СПК107 · CODESYS 3.5.17 · IEC 61131-3 (Structured Text)
   =========================================================================
   ФАЙЛ      : 05_FB_DoserControl.st
   НАЗНАЧЕНИЕ: Управляющий автомат дозатора (ядро проекта).

   ЦИКЛ ДОЗИРОВАНИЯ:
     ГОТОВНОСТЬ → ЗАЖИМ → ТАРА → ГРУБАЯ ПОДАЧА → ТОЧНАЯ ПОДАЧА →
     УСПОКОЕНИЕ → КОНТРОЛЬ (→ ДОСЫПКА) → СБРОС МЕШКА → ПАУЗА → ГОТОВНОСТЬ

   КЛЮЧЕВЫЕ ПРИНЦИПЫ:
     1. Двухступенчатая подача: основной шнек даёт ~90 % дозы,
        малый шнек — доводка. Это главный способ получить точность
        ±50 г на мешке 25 кг при грубой пневматике/механике.
     2. Отсечка «на лету» (in-flight): питатель закрывается ДО
        достижения уставки на величину продукта, который ещё летит
        в мешок:  W_отс = W_зад − Δ_лету.
     3. Адаптация Δ_лету по ошибке каждой отвешенной дозы:
        ε = W_факт − W_зад ≈ Δ_факт − Δ_принято
        Δ_лету := clamp( Δ_лету + K·ε ,  Δ_min … Δ_max )
     4. Контроль потока: за окно tFlowCheck вес обязан вырасти
        не менее чем на rFlowMinStep — иначе «затор/пусто».
     5. Failsafe: при любой аварии выходы гасятся в том же скане.
   ========================================================================= *)

FUNCTION_BLOCK FB_DoserControl

VAR_INPUT
    xEnable      : BOOL;   (* разрешение работы автоматики               *)
    xAlarmActive : BOOL;   (* есть квитируемые аварии (от FB_AlarmManager)*)
    xStartCmd    : BOOL;   (* импульс «ПУСК» (один скан)                 *)
    xStopCmd     : BOOL;   (* импульс «СТОП» (один скан)                 *)
    xAckCmd      : BOOL;   (* импульс квитирования                       *)

    (* Весовой канал (после FB_WeightChannel)                           *)
    rNet     : REAL;       (* вес нетто, кг                              *)
    xStable  : BOOL;       (* вес стабилен                               *)
    xCommOK  : BOOL;       (* связь с тензомодулем в норме               *)

    (* Дискретные сигналы (после FB_InputHandler)                       *)
    xBagPresent   : BOOL;  (* мешок в зоне загрузки                      *)
    xClampClosed  : BOOL;  (* концевик: зажим закрыт                     *)
    xAirOK        : BOOL;  (* давление пневмосети в норме                *)
    xLevelOK      : BOOL;  (* сахар в расходном бункере есть             *)
    xCoverClosed  : BOOL;  (* защитная крышка закрыта                    *)
    xEStop        : BOOL;  (* аварийный стоп (НЗ-цепь)                   *)

    (* Технологические параметры                                        *)
    p : ST_DoseParams;
END_VAR

VAR_OUTPUT
    xDoClamp  : BOOL;      (* пневмоклапан зажима мешка                  *)
    xDoCoarse : BOOL;      (* грубый питатель (основной шнек)            *)
    xDoFine   : BOOL;      (* точный питатель (малый шнек)               *)
    xTareReq  : BOOL;      (* импульс тарирования → FB_WeightChannel     *)

    eState    : E_DoserState;   (* текущее состояние (для HMI/архива)    *)
    rInFlight : REAL;           (* текущая адаптивная отсечка, кг        *)
    rLastError: REAL;           (* ошибка последней дозы, кг             *)

    (* Запросы на аварии (защёлкиваются в FB_AlarmManager)              *)
    xReqTareFault : BOOL;
    xReqNoFlow    : BOOL;
    xReqOverdose  : BOOL;
    xReqUnderdose : BOOL;
    xReqClamp     : BOOL;
END_VAR

VAR_IN_OUT
    stStats : ST_DoseStats;    (* статистика смены (хранится в GVL)      *)
END_VAR

VAR
    ePrev      : E_DoserState := ST_STOP;
    xEntry     : BOOL;         (* первый скан в состоянии               *)
    xTareSent  : BOOL;         (* импульс тарирования уже выдан         *)

    tonClamp   : TON;          (* контроль закрытия зажима              *)
    tonTare    : TON;          (* контроль времени тарирования          *)
    tonSettle  : TON;          (* успокоение продукта                   *)
    tonFlow    : TON;          (* окно контроля потока (самоперезапуск) *)
    tonTopup   : TON;          (* ограничение времени досыпки           *)
    tonRelease : TON;          (* время разжима                         *)
    tonPause   : TON;          (* пауза между циклами                   *)

    rFlowBase  : REAL;         (* вес в начале окна контроля потока     *)
    rInFlightI : REAL;         (* внутренняя адаптивная отсечка, кг     *)
    rSnapshot  : REAL;         (* вес после успокоения, кг              *)
    rErr       : REAL;         (* ошибка дозы, кг                       *)
    rBagWeight : REAL;         (* вес пустого мешка при тарировании, кг *)
    iTopupCnt  : INT;          (* счётчик попыток досыпки               *)
    xInitDone  : BOOL;
END_VAR

(* ---------------------------------------------------------------------
   0. ИНИЦИАЛИЗАЦИЯ И ОБЩИЕ ПРАВИЛА
   --------------------------------------------------------------------- *)
IF NOT xInitDone THEN
    rInFlightI := p.rInFlightInit;   (* стартовая оценка отсечки       *)
    xInitDone  := TRUE;
END_IF

rInFlight := rInFlightI;             (* наружу — для HMI/трендов       *)

(* Безопасные выходы по умолчанию. Каждый шаг сам «поднимает»
   нужные выходы — при любом сбое шаг не отрабатывается => всё отключено. *)
xDoClamp  := FALSE;
xDoCoarse := FALSE;
xDoFine   := FALSE;
xTareReq  := FALSE;

(* Жёсткая авария: аварийный стоп или потеря весов — мгновенно.        *)
IF (xEStop OR NOT xCommOK) AND (eState <> ST_STOP) AND (eState <> ST_ALARM) THEN
    eState := ST_ALARM;
END_IF

(* Запрет автоматики (например, включён РУЧНОЙ режим) → в ОСТАНОВ.    *)
IF NOT xEnable AND (eState <> ST_STOP) AND (eState <> ST_ALARM) THEN
    eState := ST_STOP;
END_IF

(* Таймеры по умолчанию сброшены; используемые шаги взводят IN.        *)
tonClamp(IN := FALSE);
tonTare(IN := FALSE);
tonSettle(IN := FALSE);
tonFlow(IN := FALSE);
tonTopup(IN := FALSE);
tonRelease(IN := FALSE);
tonPause(IN := FALSE);

(* Флаг входа в состояние — для одноразовых действий.                  *)
xEntry := (eState <> ePrev);

(* ---------------------------------------------------------------------
   1. АВТОМАТ СОСТОЯНИЙ
   --------------------------------------------------------------------- *)
CASE eState OF

    (* ── ОСТАНОВ ─────────────────────────────────────────────────── *)
    ST_STOP:
        IF xEnable AND NOT xAlarmActive THEN
            eState := ST_READY;
        END_IF

    (* ── ГОТОВНОСТЬ: ждём ПУСК и проверяем разрешения ────────────── *)
    ST_READY:
        IF xStartCmd
           AND xBagPresent AND xAirOK AND xLevelOK AND xCoverClosed
           AND NOT xAlarmActive THEN
            iTopupCnt := 0;
            eState    := ST_CLAMPING;
        END_IF

    (* ── ЗАЖИМ МЕШКА ─────────────────────────────────────────────── *)
    ST_CLAMPING:
        xDoClamp := TRUE;
        tonClamp(IN := TRUE, PT := p.tClampTimeout);
        IF xClampClosed THEN
            eState := ST_TARE;                (* концевик подтвердил   *)
        ELSIF tonClamp.Q THEN
            xReqClamp := TRUE;                (* зажим не закрылся     *)
            eState    := ST_ALARM;
        END_IF

    (* ── ТАРИРОВАНИЕ ─────────────────────────────────────────────── *)
    ST_TARE:
        xDoClamp := TRUE;

        IF xEntry THEN
            rBagWeight := rNet;               (* сейчас на весах только мешок *)
            xTareSent  := FALSE;
            (* правдоподобие веса пустого мешка *)
            IF (rBagWeight < p.rTareMin) OR (rBagWeight > p.rTareMax) THEN
                xReqTareFault := TRUE;        (* нет мешка / посторонний груз *)
                eState        := ST_ALARM;
            END_IF
        END_IF

        (* импульс тарирования — один раз, когда вес стабилен *)
        IF (eState = ST_TARE) AND xStable AND NOT xTareSent THEN
            xTareReq  := TRUE;                (* → FB_WeightChannel    *)
            xTareSent := TRUE;
        END_IF

        tonTare(IN := TRUE, PT := p.tTareTimeout);
        IF xTareSent AND ABS(rNet) <= p.rStabBand THEN
            eState := ST_FEED_COARSE;         (* ноль установлен       *)
        ELSIF tonTare.Q THEN
            xReqTareFault := TRUE;            (* не удалось стабилизировать *)
            eState        := ST_ALARM;
        END_IF

    (* ── ГРУБАЯ ПОДАЧА (~90 % дозы) ──────────────────────────────── *)
    ST_FEED_COARSE:
        xDoClamp  := TRUE;
        xDoCoarse := TRUE;

        IF xEntry THEN
            rFlowBase := rNet;
        END_IF

        (* контроль потока: самоперезапускающееся окно tFlowCheck *)
        tonFlow(IN := NOT tonFlow.Q, PT := p.tFlowCheck);
        IF tonFlow.Q THEN
            IF (rNet - rFlowBase) < p.rFlowMinStep THEN
                xReqNoFlow := TRUE;           (* затор шнека / пусто   *)
                eState     := ST_ALARM;
            ELSE
                rFlowBase := rNet;            (* следующее окно        *)
            END_IF
        END_IF

        (* отсечка грубой подачи *)
        IF rNet >= (p.rSetpoint - p.rCoarseCutoff) THEN
            eState := ST_FEED_FINE;
        END_IF

    (* ── ТОЧНАЯ ПОДАЧА (доводка малым шнеком) ────────────────────── *)
    ST_FEED_FINE:
        xDoClamp := TRUE;
        xDoFine  := TRUE;

        IF xEntry THEN
            rFlowBase := rNet;
        END_IF

        (* контроль потока (порог ниже — подача медленная) *)
        tonFlow(IN := NOT tonFlow.Q, PT := p.tFlowCheck);
        IF tonFlow.Q THEN
            IF (rNet - rFlowBase) < p.rFineFlowMin THEN
                xReqNoFlow := TRUE;
                eState     := ST_ALARM;
            ELSE
                rFlowBase := rNet;
            END_IF
        END_IF

        (* отсечка «на лету» с адаптивной поправкой *)
        IF rNet >= (p.rSetpoint - rInFlightI) THEN
            eState := ST_SETTLING;
        END_IF

    (* ── УСПОКОЕНИЕ: продукт досыпается, вес стабилизируется ─────── *)
    ST_SETTLING:
        xDoClamp := TRUE;
        tonSettle(IN := TRUE, PT := p.tSettle);
        IF tonSettle.Q THEN
            rSnapshot := rNet;                (* фиксируем результат   *)
            eState    := ST_CHECK;
        END_IF

    (* ── КОНТРОЛЬ ДОЗЫ И ОБУЧЕНИЕ ────────────────────────────────── *)
    ST_CHECK:
        xDoClamp := TRUE;
        rErr       := rSnapshot - p.rSetpoint;
        rLastError := rErr;

        IF rErr > p.rTolerancePlus THEN
            (* ПЕРЕДОЗ: автоматически высыпать нельзя — зовём оператора *)
            stStats.diOver := stStats.diOver + 1;
            xReqOverdose   := TRUE;
            eState         := ST_ALARM;

        ELSIF rErr < -p.rToleranceMinus THEN
            (* НЕДОВЕС: пробуем досыпать малым шнеком *)
            IF iTopupCnt < p.iTopupMax THEN
                eState := ST_TOPUP;
            ELSE
                stStats.diUnder := stStats.diUnder + 1;
                xReqUnderdose   := TRUE;
                eState          := ST_ALARM;
            END_IF

        ELSE
            (* ДОЗА В ДОПУСКЕ — адаптация и статистика *)
            IF p.xLearnEnable THEN
                (* Δ_лету := clamp( Δ_лету + K·ε ,  Δ_min … Δ_max ) *)
                rInFlightI := LIMIT(p.rInFlightMin,
                                    rInFlightI + p.rLearnGain * rErr,
                                    p.rInFlightMax);
            END_IF

            stStats.diCount    := stStats.diCount + 1;
            stStats.rLastNet   := rSnapshot;
            stStats.rLastError := rErr;
            stStats.rTotalNet  := stStats.rTotalNet + rSnapshot;
            stStats.rSumError  := stStats.rSumError + rErr;

            IF stStats.diCount = 1 THEN
                stStats.rMinNet := rSnapshot;
                stStats.rMaxNet := rSnapshot;
            ELSE
                stStats.rMinNet := MIN(stStats.rMinNet, rSnapshot);
                stStats.rMaxNet := MAX(stStats.rMaxNet, rSnapshot);
            END_IF

            eState := ST_UNCLAMP;
        END_IF

    (* ── ДОСЫПКА ПРИ НЕДОВЕСЕ ────────────────────────────────────── *)
    ST_TOPUP:
        xDoClamp := TRUE;
        xDoFine  := TRUE;

        IF xEntry THEN
            iTopupCnt        := iTopupCnt + 1;
            stStats.diTopups := stStats.diTopups + 1;
        END_IF

        tonTopup(IN := TRUE, PT := p.tTopupMax);
        IF (rNet >= (p.rSetpoint - rInFlightI)) OR tonTopup.Q THEN
            eState := ST_SETTLING;            (* снова успокоение+контроль *)
        END_IF

    (* ── СБРОС МЕШКА ─────────────────────────────────────────────── *)
    ST_UNCLAMP:
        xDoClamp := FALSE;                    (* разжим — мешок уходит *)
        tonRelease(IN := TRUE, PT := p.tRelease);
        IF tonRelease.Q THEN
            eState := ST_PAUSE;
        END_IF

    (* ── ПАУЗА ПЕРЕД СЛЕДУЮЩИМ ЦИКЛОМ ────────────────────────────── *)
    ST_PAUSE:
        tonPause(IN := TRUE, PT := p.tPause);
        IF tonPause.Q THEN
            eState := ST_READY;
        END_IF

    (* ── АВАРИЯ: выходы погашены, ждём квитирования ──────────────── *)
    ST_ALARM:
        IF xAckCmd AND NOT xAlarmActive AND NOT xEStop AND xCommOK THEN
            eState := ST_STOP;                (* квитировано → перезапуск *)
        END_IF

END_CASE

(* ---------------------------------------------------------------------
   2. ОПЕРАТИВНЫЙ «СТОП» ИЗ ЛЮБОГО РАБОЧЕГО СОСТОЯНИЯ:
      подача останавливается, мешок сбрасывается — безопасный выход.
   --------------------------------------------------------------------- *)
IF xStopCmd AND (eState <> ST_STOP) AND (eState <> ST_ALARM) THEN
    eState := ST_UNCLAMP;
END_IF

(* Запомнить состояние для флага xEntry следующего скана.              *)
ePrev := eState;

END_FUNCTION_BLOCK

(* =========================================================================
   КОНЕЦ ФАЙЛА 05_FB_DoserControl.st
   ========================================================================= *)
