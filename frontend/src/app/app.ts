import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs';

interface DerivationNode {
  name: string;
  lexeme?: string;
  children: DerivationNode[];
}

interface AnalyzeResponse {
  ok: boolean;
  errors?: string[];
  grammar?: {
    ok: boolean;
    errors: string[];
  };
  lexical?: {
    ok: boolean;
    errors: string[];
  };
  syntax?: {
    ok: boolean;
    accepted: boolean;
    errors: string[];
    derivationTree?: DerivationNode;
  };
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly apiUrl = '/analyze';

  public source = `Wison¿
Lex {:
     /**
      Esto es un
      Comentario de bloque
    */

    # Declaración de terminales de la forma:
    # Terminal $_NOMBRE <- EXPRESIÓN ;
       
    Terminal $_Una_A     <- 'a' ;    # cualquier carácter alfanumérico por separado
    Terminal $_Mas       <- '+' ;    # cualquier carácter especial por separado
    Terminal $_Punto     <- '.' ;    # cualquier carácter especial por separado
    Terminal $_P_Ab      <- '(' ;    # cualquier carácter especial por separado
    Terminal $_P_Ce      <- ')' ;    # cualquier carácter especial por separado
    Terminal $_FIN       <- 'FIN';   # cualquier palabra reservada
    Terminal $_Letra     <- [aA-zZ]; # alfabeto completo en mayusculas y minusculas
    Terminal $_NUMERO    <- [0-9] ;  # Digitos del 0 al 9
    Terminal $_NUMEROS   <- [0-9]* ; # Estrella de Kleene para hacer 0 o n veces
    Terminal $_NUMEROS_2 <- [0-9]+ ; # Cerradura positiva para hacer 1 on veces
    Terminal $_NUMEROS_3 <- [0-9]? ; # reconoce la cláusula ? para hacer 0 o 1 vez 
    Terminal $_Decimal   <- ([0-9]*)($_Punto)($_NUMEROS_2); # terminal combinado

:}

Syntax {{:
   # Declaración de no terminales de la forma
   # No_Terminal %_Nombre ;

   No_Terminal %_Prod_A;
   No_Terminal %_Prod_B;
   No_Terminal %_Prod_C;
   No_Terminal %_S;
   
   
   # Simbolo inicial de la forma
   # Initial_Sim %_Nombre ;
 
   Initial_Sim %_S ;

   #Todo símbolo no terminal debe ser declarado antes de usarse en las producciones
   # Las producciones son de la siguiente forma
   # %_Initial_Sim  <= %_Prod_A ... %_No_terminal_N o $_Terminal_N ... ;
   
  %_S <= %_Prod_A $_FIN ;
  %_Prod_A <= $_P_Ab %_Prod_B $_P_Ce ;
  %_Prod_B <= %_Prod_C ;
  %_Prod_C <= $_Una_A $_Mas $_Una_A ;
:}}
?Wison`;

  public input = '(a+a)FIN';
  public loading = false;
  public response: AnalyzeResponse | null = null;
  public requestError = '';

  analyze(): void {
    this.loading = true;
    this.requestError = '';
    this.response = null;

    this.http.post<AnalyzeResponse>(this.apiUrl, {
      source: this.source,
      input: this.input
    }).pipe(
      timeout(15000),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (result) => {
        this.response = result;
      },
      error: (error) => {
        this.response = error?.error ?? null;

        if (error?.name === 'TimeoutError') {
          this.requestError = 'El backend tardo demasiado en responder (timeout 15s).';
          return;
        }

        this.requestError = error?.error?.errors?.[0] || 'No se pudo conectar con el backend.';
      }
    });
  }

  get treeRoot(): DerivationNode | null {
    return this.response?.syntax?.derivationTree ?? null;
  }

  treeToAscii(): string {
    const root = this.treeRoot;
    if (!root) {
      return '';
    }

    const lines: string[] = [];

    const labelOf = (node: DerivationNode): string => {
      return node.lexeme ? `${node.name} (${node.lexeme})` : node.name;
    };

    const visit = (node: DerivationNode, prefix: string, isLast: boolean): void => {
      const connector = isLast ? '\\- ' : '|- ';
      lines.push(`${prefix}${connector}${labelOf(node)}`);

      const children = node.children || [];
      const nextPrefix = `${prefix}${isLast ? '   ' : '|  '}`;

      for (let index = 0; index < children.length; index += 1) {
        visit(children[index], nextPrefix, index === children.length - 1);
      }
    };

    lines.push(labelOf(root));

    const rootChildren = root.children || [];
    for (let index = 0; index < rootChildren.length; index += 1) {
      visit(rootChildren[index], '', index === rootChildren.length - 1);
    }

    return lines.join('\n');
  }
}
