%lex
%x IN_LEX IN_SYNTAX

%%

<INITIAL>[\r\n\t\ ]+                       /* skip */
<INITIAL>\#.*                                /* skip line comment */
<INITIAL>\/\*[^*]*\*+([^/*][^*]*\*+)*\/   /* skip block comment */
<INITIAL>Wison                                return 'WISON';
<INITIAL>\?Wison                             return 'END_WISON';
<INITIAL>Lex                                  return 'LEX';
<INITIAL>Syntax                               return 'SYNTAX';
<INITIAL>"{{:"                               { this.begin('IN_SYNTAX'); return 'OPEN_SYNTAX'; }
<INITIAL>"{:"                                 { this.begin('IN_LEX'); return 'OPEN_BLOCK'; }

<IN_LEX>":}"                                  { this.begin('INITIAL'); return 'CLOSE_BLOCK'; }
<IN_LEX>[\s\S]                               return 'LEX_CHAR';

<IN_SYNTAX>":}}"                             { this.begin('INITIAL'); return 'CLOSE_SYNTAX'; }
<IN_SYNTAX>[\s\S]                            return 'SYNTAX_CHAR';

<INITIAL>.                                  return 'INVALID';

/lex

%start program

%token WISON END_WISON LEX SYNTAX OPEN_BLOCK CLOSE_BLOCK OPEN_SYNTAX CLOSE_SYNTAX LEX_CHAR SYNTAX_CHAR INVALID

%%

program
  : WISON lexBlock syntaxBlock END_WISON
    {
      $$ = {
        lexRaw: $2,
        syntaxRaw: $3
      };
      return $$;
    }
  ;

lexBlock
  : LEX OPEN_BLOCK lexContent CLOSE_BLOCK
    {
      $$ = $3;
    }
  ;

lexContent
  :
    {
      $$ = '';
    }
  | lexContent LEX_CHAR
    {
      $$ = $1 + $2;
    }
  ;

syntaxBlock
  : SYNTAX OPEN_SYNTAX syntaxContent CLOSE_SYNTAX
    {
      $$ = $3;
    }
  ;

syntaxContent
  :
    {
      $$ = '';
    }
  | syntaxContent SYNTAX_CHAR
    {
      $$ = $1 + $2;
    }
  ;