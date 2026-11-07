// Bulk matching results as parsed by LinkJob.svelte (grouped by source line).
export const sourceHeader = ['nom', 'prenom', 'naissance', 'deces', 'extra'];

export const mapping = {
  direct: { nom: 'lastName', prenom: 'firstName', naissance: 'birthDate', deces: 'deathDate' },
  reverse: { lastName: 'nom', firstName: 'prenom', birthDate: 'naissance', deathDate: 'deces' }
};

export const resultsHeader = [...sourceHeader, 'sourceLineNumber', 'score', 'scores',
  'name.last', 'name.first', 'birth.date', 'death.date', 'id'];

const scores = (score, name = 0.9) => JSON.stringify({ score, name: { score: name }, birthDate: 1 });

const row = (src, line, score, matched) => [
  ...src, `${line}`, score === undefined ? '' : `${score}`, score === undefined ? '' : scores(score, matched?.nameScore),
  ...(matched ? [matched.last, matched.first, matched.birth, matched.death, matched.id] : ['', '', '', '', ''])
];

// 4 source lines: 1 high score, 2 with two candidates, 3 unmatched, 4 medium score
export const buildResults = () => {
  const complete = [
    [row(['Dupont', 'Jean', '01/02/1950', '', 'x1'], 1, 0.95, { last: 'DUPONT', first: 'JEAN', birth: '19500201', death: '20200101', id: 'id1' })],
    [
      row(['Martin', 'Marie', '03/04/1960', '', 'x2'], 2, 0.6, { last: 'MARTIN', first: 'MARIE', birth: '19600403', death: '20200202', id: 'id2' }),
      row(['Martin', 'Marie', '03/04/1960', '', 'x2'], 2, 0.5, { last: 'MARTINE', first: 'MARIE', birth: '19600404', death: '20200303', id: 'id3', nameScore: 0.5 })
    ],
    [row(['Durand', 'Paul', '05/06/1970', '', 'x3'], 3)],
    [row(['Petit', 'Luc', '07/08/1980', '01/01/2020', '0123'], 4, 0.7, { last: 'PETIT', first: 'LUC', birth: '19800807', death: '20200101', id: 'id4', nameScore: 0.4 })]
  ];
  return {
    complete: { header: [...resultsHeader], rows: complete },
    results: { header: [...resultsHeader], rows: complete.filter(r => r[0][resultsHeader.indexOf('score')]) }
  };
};

export const col = (name) => resultsHeader.indexOf(name);
