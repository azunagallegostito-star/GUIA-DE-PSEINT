// Ejemplos precargados para el simulador
const ejemplos = {
  suma: `Algoritmo SumaDosNumeros
    Definir a, b, suma Como Real;
    Escribir 'Ingrese el primer numero:';
    Leer a;
    Escribir 'Ingrese el segundo numero:';
    Leer b;
    suma <- a + b;
    Escribir 'La suma es: ', suma;
FinAlgoritmo`,
  edad: `Algoritmo MayorDeEdad
    Definir edad Como Entero;
    Escribir 'Ingrese su edad:';
    Leer edad;
    Si edad >= 18 Entonces
        Escribir 'Eres mayor de edad.';
    Sino
        Escribir 'Eres menor de edad.';
    FinSi
FinAlgoritmo`,
  tabla: `Algoritmo TablaMultiplicar
    Definir num, i, res Como Entero;
    Escribir 'Numero de tabla a mostrar:';
    Leer num;
    Para i <- 1 Hasta 10 Hacer
        res <- num * i;
        Escribir num, ' x ', i, ' = ', res;
    FinPara
FinAlgoritmo`
};

const editor = document.getElementById("editor");
const consola = document.getElementById("consola");
const cajaLeer = document.getElementById("caja-leer");
const inputLeer = document.getElementById("input-leer");
let estado = null;

function cargarEjemplo(clave) {
  editor.value = ejemplos[clave];
  cajaLeer.style.display = "none";
  consola.textContent = "*** Ejemplo cargado. Presiona 'Ejecutar'. ***";
}

function escribirConsola(texto) {
  consola.textContent += "\n" + texto;
  consola.scrollTop = consola.scrollHeight;
}

function evaluarExpresion(expr, variables) {
  let expresionJS = expr.trim()
    .replace(/\bMOD\b/gi, "%")
    .replace(/\^/g, "**")
    .replace(/<>/g, "!==")
    .replace(/([^<>!])=([^=])/g, "$1===$2")
    .replace(/\bY\b/gi, "&&")
    .replace(/\bO\b/gi, "||")
    .replace(/\bNO\b/gi, "!");

  const partes = expresionJS.split(/('[^']*'|"[^"]*")/g);
  for (let i = 0; i < partes.length; i += 2) {
    partes[i] = partes[i].replace(/\b[a-zA-Z_]\w*\b/g, function (identificador) {
      if (identificador in variables) {
        return typeof variables[identificador] === "string"
          ? JSON.stringify(variables[identificador])
          : variables[identificador];
      }
      return identificador;
    });
  }

  return Function('"use strict"; return (' + partes.join("") + ')')();
}

function ejecutarPaso() {
  try {
    while (estado && estado.lineaActual < estado.lineas.length) {
      const linea = estado.lineas[estado.lineaActual].trim().replace(/;$/, "");

      if (!linea || linea.startsWith("//")) {
        estado.lineaActual++;
        continue;
      }

      if (/^Algoritmo\b/i.test(linea)) {
        escribirConsola("*** Ejecución iniciada ***");
        estado.lineaActual++;
      } else if (/^FinAlgoritmo\b/i.test(linea)) {
        escribirConsola("*** Ejecución finalizada ***");
        estado = null;
        return;
      } else if (/^Definir\s+(.+)\s+Como\s+\w+$/i.test(linea)) {
        const listaVars = RegExp.$1.split(",");
        for (let i = 0; i < listaVars.length; i++) {
          estado.variables[listaVars[i].trim()] = 0;
        }
        estado.lineaActual++;
      } else if (/^Escribir\s+(.+)$/i.test(linea)) {
        const argumentos = RegExp.$1.match(/('[^']*'|"[^"]*"|[^,]+)/g) || [];
        let salida = "";
        for (let i = 0; i < argumentos.length; i++) {
          salida += evaluarExpresion(argumentos[i], estado.variables);
        }
        escribirConsola("> " + salida);
        estado.lineaActual++;
      } else if (/^Leer\s+([a-zA-Z_]\w*)$/i.test(linea)) {
        estado.esperandoVar = RegExp.$1;
        document.getElementById("lbl-leer").textContent = "Leer " + estado.esperandoVar + ":";
        inputLeer.value = "";
        cajaLeer.style.display = "flex";
        inputLeer.focus();
        return;
      } else if (/^Si\s+(.+)\s+Entonces$/i.test(linea)) {
        if (evaluarExpresion(RegExp.$1, estado.variables)) {
          estado.lineaActual++;
        } else {
          while (++estado.lineaActual < estado.lineas.length &&
                 !/^(Sino|FinSi)$/i.test(estado.lineas[estado.lineaActual].trim().replace(/;$/, ""))) {}
          estado.lineaActual++;
        }
      } else if (/^Sino$/i.test(linea)) {
        while (++estado.lineaActual < estado.lineas.length &&
               !/^FinSi$/i.test(estado.lineas[estado.lineaActual].trim().replace(/;$/, ""))) {}
        estado.lineaActual++;
      } else if (/^FinSi$/i.test(linea)) {
        estado.lineaActual++;
      } else if (/^Para\s+([a-zA-Z_]\w*)\s*<-\s*(.+?)\s+Hasta\s+(.+?)\s+Hacer$/i.test(linea)) {
        const coincidencia = linea.match(/^Para\s+([a-zA-Z_]\w*)\s*<-\s*(.+?)\s+Hasta\s+(.+?)\s+Hacer$/i);
        const variable = coincidencia[1];
        const inicio = Number(evaluarExpresion(coincidencia[2], estado.variables));
        const fin = Number(evaluarExpresion(coincidencia[3], estado.variables));
        estado.variables[variable] = inicio;
        estado.bucle = { inicioLinea: estado.lineaActual, variable: variable, maximo: fin };
        estado.lineaActual++;
      } else if (/^FinPara$/i.test(linea)) {
        if (estado.bucle && ++estado.variables[estado.bucle.variable] <= estado.bucle.maximo) {
          estado.lineaActual = estado.bucle.inicioLinea + 1;
        } else {
          estado.bucle = null;
          estado.lineaActual++;
        }
      } else if (/^([a-zA-Z_]\w*)\s*<-\s*(.+)$/.test(linea)) {
        const coincidencia = linea.match(/^([a-zA-Z_]\w*)\s*<-\s*(.+)$/);
        estado.variables[coincidencia[1]] = evaluarExpresion(coincidencia[2], estado.variables);
        estado.lineaActual++;
      } else {
        throw new Error("Sintaxis no válida -> " + linea);
      }
    }
  } catch (error) {
    escribirConsola("Error: " + error.message);
    cajaLeer.style.display = "none";
    estado = null;
  }
}

document.getElementById("btn-run").addEventListener("click", function () {
  consola.textContent = "";
  cajaLeer.style.display = "none";
  estado = {
    lineas: editor.value.split("\n"),
    lineaActual: 0,
    variables: {},
    esperandoVar: null,
    bucle: null
  };
  ejecutarPaso();
});

document.getElementById("btn-clear").addEventListener("click", function () {
  cajaLeer.style.display = "none";
  consola.textContent = "*** Consola limpia. ***";
});

function confirmarEntrada() {
  if (!estado || !estado.esperandoVar) return;
  const valor = inputLeer.value.trim();
  estado.variables[estado.esperandoVar] = (valor !== "" && !isNaN(Number(valor))) ? Number(valor) : valor;
  escribirConsola("  [Entrada: " + estado.variables[estado.esperandoVar] + "]");
  estado.esperandoVar = null;
  estado.lineaActual++;
  cajaLeer.style.display = "none";
  ejecutarPaso();
}

document.getElementById("btn-ok").addEventListener("click", confirmarEntrada);

inputLeer.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    confirmarEntrada();
  }
});

// Autoevaluación
document.getElementById("form-quiz").addEventListener("submit", function (e) {
  e.preventDefault();
  const respuestasCorrectas = { q1: "b", q2: "c", q3: "a" };
  let puntaje = 0;

  for (const pregunta in respuestasCorrectas) {
    const seleccionada = e.target.querySelector('input[name="' + pregunta + '"]:checked');
    if (seleccionada && seleccionada.value === respuestasCorrectas[pregunta]) {
      puntaje++;
    }
  }

  const cajaResultado = document.getElementById("resultado");
  cajaResultado.style.display = "block";
  cajaResultado.style.backgroundColor = puntaje === 3 ? "#dcfce7" : "#fef9c3";
  cajaResultado.style.border = puntaje === 3 ? "1px solid #16a34a" : "1px solid #ca8a04";
  cajaResultado.innerHTML =
    "<strong>Puntaje obtenido: " + puntaje + " / 3 puntos.</strong> " +
    (puntaje === 3 ? "¡Excelente dominio de PSeInt!" : "Repasa las tarjetas de pasos clave e inténtalo de nuevo.");
});

// Cargar el primer ejemplo al abrir la página
cargarEjemplo("suma");
