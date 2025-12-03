21.08.2025 - ONAT ATMACA

====================================
 PivotGrid Widget - Änderungen
====================================

Ziele:
------
1) Werte mittig anzeigen
2) Start = alles aufgeklappt
3) Kein Einklappen durch User

------------------------------------
CSS (style.css):
----------------
+ Werte mittig:
.dx-pivotgrid .dx-pivotgrid-area-data tbody td {
  text-align: center !important;
}

+ Expand/Collapse-Icons ausblenden:
.dx-pivotgrid .dx-expand { display: none !important; }
.dx-pivotgrid .dx-pivotgrid-collapsed,
.dx-pivotgrid .dx-pivotgrid-expanded { cursor: default !important; }

------------------------------------
JS (main.js):
--------------
+ onContentReady:
  ? expandAll() für alle Row/Column-Felder
  ? nur einmal beim Laden

+ onCellClick:
  ? e.cancel = true
  ? verhindert Einklappen durch User

------------------------------------
Effekt:
-------
? Alle Werte zentriert  
? Grid startet voll aufgeklappt  
? User kann nicht mehr zuklappen
