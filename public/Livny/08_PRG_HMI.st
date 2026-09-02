(* =========================================================================
   ПРОЕКТ    : Весовой дозатор сахара в мешки 25/50 кг («Ливны»)
   ПЛАТФОРМА : ОВЕН СПК107 · CODESYS 3.5.17 · IEC 61131-3 (Structured Text)
   =========================================================================
   ФАЙЛ      : 08_PRG_HMI.st
   НАЗНАЧЕНИЕ: Сервисная программа интерфейса оператора (встроенный
               7" экран СПК107): защита полей ввода, быстрые рецепты
               25/50 кг, сброс статистики, подготовка отображаемых
               полей g_Hmi.* и мнемокода состояния.

               Объекты визуализации CODESYS привязываются напрямую
               к переменным GVL (g_Hmi.*, g_xHmi*, g_Manual.*).
   ========================================================================= *)

PROGRAM PRG_HMI

VAR
    rtRecipe25 : R_TRIG;
    rtRecipe50 : R_TRIG;
    rtReset    : R_TRIG;
END_VAR

(* ---------------------------------------------------------------------
   1. ЗАЩИТА ПОЛЯ ВВОДА УСТАВКИ (от случайных/зависших значений экрана)
   --------------------------------------------------------------------- *)
g_rHmiSetpoint := LIMIT(g_Params.rSetpointMin, g_rHmiSetpoint, g_Params.rSetpointMax);

(* Передача уставки в технологические параметры *)
g_Params.rSetpoint := g_rHmiSetpoint;

(* ---------------------------------------------------------------------
   2. БЫСТРЫЕ РЕЦЕПТЫ С ЭКРАНА
   --------------------------------------------------------------------- *)
rtRecipe25(CLK := g_xHmiRecipe25);
IF rtRecipe25.Q THEN
    g_rHmiSetpoint := 25.0;     (* мешок 25 кг *)
END_IF

rtRecipe50(CLK := g_xHmiRecipe50);
IF rtRecipe50.Q THEN
    g_rHmiSetpoint := 50.0;     (* мешок 50 кг *)
END_IF

(* ---------------------------------------------------------------------
   3. СБРОС СТАТИСТИКИ СМЕНЫ
   --------------------------------------------------------------------- *)
rtReset(CLK := g_xHmiResetStat);
IF rtReset.Q THEN
    g_Stats.diCount    := 0;
    g_Stats.rTotalNet  := 0.0;
    g_Stats.rLastNet   := 0.0;
    g_Stats.rLastError := 0.0;
    g_Stats.rSumError  := 0.0;
    g_Stats.rMinNet    := 0.0;
    g_Stats.rMaxNet    := 0.0;
    g_Stats.diUnder    := 0;
    g_Stats.diOver     := 0;
    g_Stats.diTopups   := 0;
END_IF

(* ---------------------------------------------------------------------
   4. ОТОБРАЖАЕМЫЕ ПОЛЯ ЭКРАНА
   --------------------------------------------------------------------- *)
g_Hmi.rNet       := g_Weight.rNet;
g_Hmi.rSetpoint  := g_Params.rSetpoint;
g_Hmi.rLastError := g_Stats.rLastError;
g_Hmi.rFlowRate  := g_Weight.rFlowRate;
g_Hmi.diCount    := g_Stats.diCount;
g_Hmi.rLastNet   := g_Stats.rLastNet;
g_Hmi.iState     := TO_INT(g_eState);
g_Hmi.xStable    := g_Weight.xStable;
g_Hmi.xCommOK    := g_Weight.xCommOK;
g_Hmi.xManual    := g_xManualMode;

(* Мнемокод состояния для строки статуса *)
CASE g_eState OF
    ST_STOP:        g_Hmi.sState := 'СТОП';
    ST_READY:       g_Hmi.sState := 'ГОТОВ';
    ST_CLAMPING:    g_Hmi.sState := 'ЗАЖИМ';
    ST_TARE:        g_Hmi.sState := 'ТАРА';
    ST_FEED_COARSE: g_Hmi.sState := 'ГРУБО';
    ST_FEED_FINE:   g_Hmi.sState := 'ТОЧНО';
    ST_SETTLING:    g_Hmi.sState := 'УСПОК';
    ST_CHECK:       g_Hmi.sState := 'КОНТР';
    ST_TOPUP:       g_Hmi.sState := 'ДОСЫП';
    ST_UNCLAMP:     g_Hmi.sState := 'СБРОС';
    ST_PAUSE:       g_Hmi.sState := 'ПАУЗА';
    ST_ALARM:       g_Hmi.sState := 'АВАРИЯ';
ELSE
    g_Hmi.sState := '---';
END_CASE

END_PROGRAM

(* =========================================================================
   КОНЕЦ ФАЙЛА 08_PRG_HMI.st
   ========================================================================= *)
