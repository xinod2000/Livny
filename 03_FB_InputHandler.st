(* =========================================================================
   ПРОЕКТ    : Весовой дозатор сахара в мешки 25/50 кг («Ливны»)
   ПЛАТФОРМА : ОВЕН СПК107 · CODESYS 3.5.17 · IEC 61131-3 (Structured Text)
   =========================================================================
   ФАЙЛ      : 03_FB_InputHandler.st
   НАЗНАЧЕНИЕ: Антидребезг дискретных входов (МВ110-8Д.4Р) и выделение
               фронтов кнопок. Дискретизация опроса модуля по RS-485 —
               десятки мс, поэтому фильтруем 40 мс (TON).

               В CODESYS: "Добавить объект → ФБ", язык ST.
   ========================================================================= *)

FUNCTION_BLOCK FB_InputHandler

VAR_INPUT
    xRawStart       : BOOL;   (* «сырой» DI0 ПУСК                         *)
    xRawStop        : BOOL;   (* «сырой» DI1 СТОП                         *)
    xRawEStop       : BOOL;   (* «сырой» DI2 АВАРИЙНЫЙ СТОП (НЗ-контакт)  *)
    xRawBag         : BOOL;   (* «сырой» DI3 мешок в зоне                 *)
    xRawClampClosed : BOOL;   (* «сырой» DI4 концевик зажима              *)
    xRawAirOK       : BOOL;   (* «сырой» DI5 давление воздуха             *)
    xRawLevel       : BOOL;   (* «сырой» DI6 уровень в бункере            *)
    xRawCover       : BOOL;   (* «сырой» DI7 защитная крышка              *)
END_VAR

VAR_OUTPUT
    xStart        : BOOL;     (* ПУСК, отфильтрованный                    *)
    xStop         : BOOL;     (* СТОП, отфильтрованный                    *)
    xStartUp      : BOOL;     (* фронт кнопки ПУСК (один скан)            *)
    xStopUp       : BOOL;     (* фронт кнопки СТОП (один скан)            *)
    xEStop        : BOOL;     (* АВАРИЯ активна (инверсия НЗ-контакта)    *)
    xBagPresent   : BOOL;     (* мешок установлен в зону загрузки         *)
    xClampClosed  : BOOL;     (* зажим механически закрыт                 *)
    xAirOK        : BOOL;     (* давление пневмосети в норме              *)
    xLevelOK      : BOOL;     (* продукт в бункере есть                   *)
    xCoverClosed  : BOOL;     (* защитная крышка закрыта                  *)
END_VAR

VAR
    (* Фильтры антидребезга: TON с выдержкой tDebounce                  *)
    tonStart : TON;
    tonStop  : TON;
    tonEStop : TON;
    tonBag   : TON;
    tonClamp : TON;
    tonAir   : TON;
    tonLevel : TON;
    tonCover : TON;

    (* Детекторы фронта для кнопок                                      *)
    rtStart  : R_TRIG;
    rtStop   : R_TRIG;

    tDebounce : TIME := T#40MS;  (* Постоянная антидребезга               *)
END_VAR

(* ---------------------------------------------------------------------
   1. АНТИДРЕБЕЗГ. Вход считается принятым, если удерживается
      не менее tDebounce. Для цепей безопасности (аварийный стоп)
      это не ухудшает быстродействие: НЗ-контакт при срабатывании
      РАЗМЫКАЕТСЯ, и инверсный признак аварии снимает разрешение
      выходов уже в следующем скане.
   --------------------------------------------------------------------- *)
tonStart(IN := xRawStart,       PT := tDebounce);
tonStop (IN := xRawStop,        PT := tDebounce);
tonEStop(IN := xRawEStop,       PT := tDebounce);
tonBag  (IN := xRawBag,         PT := tDebounce);
tonClamp(IN := xRawClampClosed, PT := tDebounce);
tonAir  (IN := xRawAirOK,       PT := tDebounce);
tonLevel(IN := xRawLevel,       PT := tDebounce);
tonCover(IN := xRawCover,       PT := tDebounce);

xStart       := tonStart.Q;
xStop        := tonStop.Q;

(* Аварийный стоп — НЗ-контакт: пока цепь цела, вход = TRUE.
   Размыкание (нажатие/обрыв) даёт xEStop = TRUE.                     *)
xEStop       := NOT tonEStop.Q;

xBagPresent  := tonBag.Q;
xClampClosed := tonClamp.Q;
xAirOK       := tonAir.Q;
xLevelOK     := tonLevel.Q;
xCoverClosed := tonCover.Q;

(* ---------------------------------------------------------------------
   2. ФРОНТЫ КНОПОК — для запуска/останова цикла из любого состояния.
   --------------------------------------------------------------------- *)
rtStart(CLK := xStart);
xStartUp := rtStart.Q;

rtStop(CLK := xStop);
xStopUp  := rtStop.Q;

END_FUNCTION_BLOCK

(* =========================================================================
   КОНЕЦ ФАЙЛА 03_FB_InputHandler.st
   ========================================================================= *)
