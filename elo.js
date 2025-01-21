

class RollerDerbyElo {
    constructor(rollerDerbyTeams = {}) {
        this.reasons = {};
        this.allTeams = rollerDerbyTeams;
    }

    addTeam(teamId) {
        if (!(teamId in this.allTeams)) {
            this.allTeams[teamId] = new RollerDerbyTeam('Unknown Team', 600, 300, teamId);
        }
    }

    expectedScore(ra, rb) {
        return 1 / (1 + Math.pow(10, ((rb - ra) / 400)));
    }

    updateRatings(games) {
        let adjustmentsA = {};
        let adjustmentsB = {};

        //console.log('teams ' + this.allTeams);
        for (let team in this.allTeams) {
            adjustmentsA[team] = 0;
        }

        for (let team in this.allTeams) {
            adjustmentsB[team] = 0;
        }

        for (let i = 0; i < games.length; i++) {
            //let [games[i].teamA, games[i].scoreA, games[i].charterA, 
            //games[i].teamB, games[i].scoreB, games[i].charterB, 
            //games[i].forfeit] = game;



            this.addTeam(games[i].teamA);
            this.addTeam(games[i].teamB);


            games[i].charterA === 'primary' ? this.allTeams[games[i].teamA].numberOfGamesA++ : this.allTeams[games[i].teamA].numberOfGamesB++;
            games[i].charterB === 'primary' ? this.allTeams[games[i].teamB].numberOfGamesA++ : this.allTeams[games[i].teamB].numberOfGamesB++;

            if (games[i].forfeit) {
                console.log('forfeit ' + games[i]);
                continue;
            }


            let ra = games[i].charterA === 'primary' ? this.allTeams[games[i].teamA].ratingA : this.allTeams[games[i].teamA].ratingB;
            let rb = games[i].charterB === 'primary' ? this.allTeams[games[i].teamB].ratingA : this.allTeams[games[i].teamB].ratingB;

            let ea = this.expectedScore(ra, rb);
            let eb = this.expectedScore(rb, ra);

            console.log(`For game on: ${games[i].datetime}`);

            let sa = this.sigmoid_actual_score(games[i].scoreA, games[i].scoreB)
            //let sa = this.normalised_actual_score(scoreA, scoreB)
            //let sa = this.normalised_actual_score_with_bonus(scoreA, scoreB)

            let sb = 1 - sa  // Complementary probability for team B

            let k = 128;

            let adjustA = k * (sa - ea);
            let adjustB = k * (sb - eb);


            //console.log(games[i]);

            games[i].charterA === 'primary' ? adjustmentsA[games[i].teamA] += adjustA : adjustmentsB[games[i].teamA] += adjustA;
            games[i].charterB === 'primary' ? adjustmentsA[games[i].teamB] += adjustB : adjustmentsB[games[i].teamB] += adjustB;

            //console.log(this.allTeams[games[i].teamA].teamName);
            //console.log(this.allTeams[games[i].teamA].ratingA);
            //console.log(adjustA);
            //console.log(this.allTeams[games[i].teamB].teamName);
            //console.log(this.allTeams[games[i].teamB].ratingA);
            //console.log(adjustB);

            this.allTeams[games[i].teamA].addGameResult(games[i].charterA, games[i].date, this.allTeams[games[i].teamB].teamName + " " + games[i].charterB, games[i].scoreA, games[i].scoreB, adjustA, this.allTeams[games[i].teamA].ratingA);
            this.allTeams[games[i].teamB].addGameResult(games[i].charterB, games[i].date, this.allTeams[games[i].teamA].teamName + " " + games[i].charterA, games[i].scoreB, games[i].scoreA, adjustB, this.allTeams[games[i].teamB].ratingA);
        }

        for (let team in adjustmentsA) {
            this.allTeams[team].ratingA += adjustmentsA[team];
            //console.log(this.allTeams[team]);
            //console.log(adjustmentsA[team]);
        }
        for (let team in adjustmentsB) {
            this.allTeams[team].ratingB += adjustmentsB[team];
            //console.log(this.allTeams[team]);
            //console.log(adjustmentsB[team]);
        }


    }

    explainFor(team) {
        return this.reasons[team] || "No explanation available.";
    }

    sigmoid_actual_score(scoreA, scoreB) {
        let score_diff = scoreA - scoreB
        return 1 / (1 + Math.exp(-0.008 * score_diff)); // Sigmoid function for proportional scores
    }

    normalised_actual_score(scoreA, scoreB) {
        let total_score = scoreA + scoreB
        return scoreA / total_score
    }

    normalised_actual_score_with_bonus(scoreA, scoreB) {
        let total_score = scoreA + scoreB
        let normalized_score_A = scoreA / total_score
        let normalized_score_B = scoreB / total_score

        // Weight the Normalized Scores
        let weighted_normalized_score_A = 2 * normalized_score_A
        let weighted_normalized_score_B = 2 * normalized_score_B

        // Calculate the Bonus Scores
        let bonus_score_A = 0.01 * Math.sqrt(scoreA)
        let bonus_score_B = 0.01 * Math.sqrt(scoreB)

        // Combine Weighted Normalized Scores with Bonus
        let score_with_bonus_A = weighted_normalized_score_A + bonus_score_A
        let score_with_bonus_B = weighted_normalized_score_B + bonus_score_B

        // Normalize the Combined Scores
        let total_score_with_bonus = score_with_bonus_A + score_with_bonus_B

        return score_with_bonus_A / total_score_with_bonus
    }

}

async function fetchGames(apiUrl) {
    try {
        let response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let data = await response.json();

        // Create an object to hold games grouped by sanctioning_id
        let groupedGames = data.payload.reduce((acc, game) => {
            let sanctioningId = game.event.sanctioning_id;
            if (!acc[sanctioningId]) {
                acc[sanctioningId] = [];
            }
            acc[sanctioningId].push({
                date: game.event.game_datetime,
                teamA: game.event.home_league,
                scoreA: game.event.home_league_score,
                charterA: game.event.home_league_charter,
                teamB: game.event.away_league,
                scoreB: game.event.away_league_score,
                charterB: game.event.away_league_charter,
                forfeit: game.event.forfeit
            });
            return acc;
        }, {});

        // Ensure groupedGames is correctly created and converted
        let result = Object.keys(groupedGames).map(sanctioningId => ({
            sanctioningId,
            games: groupedGames[sanctioningId]
        }));

        // Print the grouped games to the console for debugging
        //console.log(result);

        return result;
    } catch (error) {
        console.error('Error fetching games data:', error);
    }
}


const rollerDerbyTeams = {};

async function main() {

    rollerDerbyTeams['2676'] = new RollerDerbyTeam('Austin Anarchy', 749.3, 360, '2676');
    rollerDerbyTeams['2680'] = new RollerDerbyTeam('Bridgetown Roller Derby', 600, 300, '2680');
    rollerDerbyTeams['2681'] = new RollerDerbyTeam('Brisbane City Rollers', 600, 300, '2681');
    rollerDerbyTeams['2683'] = new RollerDerbyTeam('Capital City Hooligans', 600, 300, '2683');
    rollerDerbyTeams['2685'] = new RollerDerbyTeam('Carolina Wreckingballs', 781.7, 390, '2685');
    rollerDerbyTeams['2686'] = new RollerDerbyTeam('Casco Bay Roller Derby', 722.2, 360, '2686');
    rollerDerbyTeams['2687'] = new RollerDerbyTeam('Chicago Bruise Brothers', 817.3, 400, '2687');
    rollerDerbyTeams['2689'] = new RollerDerbyTeam('Cleveland Guardians Roller Derby', 573.4, 260, '2689');
    rollerDerbyTeams['2690'] = new RollerDerbyTeam('Collision Roller Derby', 600, 300, '2690');
    rollerDerbyTeams['2692'] = new RollerDerbyTeam('Crash Test Brummies', 636, 315, '2692');
    rollerDerbyTeams['2693'] = new RollerDerbyTeam('Denver Ground Control', 902.5, 450, '2693');
    rollerDerbyTeams['2694'] = new RollerDerbyTeam('Detroit Mens Roller Derby', 600.6, 300, '2694');
    rollerDerbyTeams['2695'] = new RollerDerbyTeam('Golden State Heat', 600, 300, '2695');
    rollerDerbyTeams['2696'] = new RollerDerbyTeam('Chinook City Roller Derby', 719.1, 350, '2696');
    rollerDerbyTeams['2697'] = new RollerDerbyTeam('Harm City Mens Derby', 600, 300, '2697');
    rollerDerbyTeams['2699'] = new RollerDerbyTeam('Lane County Concussion', 750.6, 375, '2699');
    rollerDerbyTeams['2701'] = new RollerDerbyTeam('Magic City Misfits', 973.6, 450, '2701');
    rollerDerbyTeams['2702'] = new RollerDerbyTeam('Manchester Roller Derby', 861, 600, '2702');
    rollerDerbyTeams['2703'] = new RollerDerbyTeam('Manneken Beasts', 600, 300, '2703');
    rollerDerbyTeams['2704'] = new RollerDerbyTeam('Mass Maelstrom', 600, 300, '2704');
    rollerDerbyTeams['2706'] = new RollerDerbyTeam('Wisconsin United Roller Derby', 600, 300, '2706');
    rollerDerbyTeams['2708'] = new RollerDerbyTeam('Montreal Mens Roller Derby', 600, 300, '2708');
    rollerDerbyTeams['2710'] = new RollerDerbyTeam('New Orleans Brass Roller Derby', 600, 300, '2710');
    rollerDerbyTeams['2712'] = new RollerDerbyTeam('East Midlands Open Roller Derby', 350, 150, '2712');
    rollerDerbyTeams['2714'] = new RollerDerbyTeam('Panam Squad', 619.4, 300, '2714');
    rollerDerbyTeams['2715'] = new RollerDerbyTeam('Philadelphia Hooligans', 766.7, 375, '2715');
    rollerDerbyTeams['2717'] = new RollerDerbyTeam('Puget Sound Outcast Derby', 792.4, 380, '2717');
    rollerDerbyTeams['2718'] = new RollerDerbyTeam('Mohawk Valley Roller Derby', 600, 300, '2718');
    rollerDerbyTeams['2719'] = new RollerDerbyTeam('Race City Rebels', 794.1, 380, '2719');
    rollerDerbyTeams['2723'] = new RollerDerbyTeam('San Diego Aftershocks', 809.8, 400, '2723');
    rollerDerbyTeams['2725'] = new RollerDerbyTeam('South Wales Silures', 647.6, 320, '2725');
    rollerDerbyTeams['2727'] = new RollerDerbyTeam('Saint Louis Gatekeepers', 962.4, 650, '2727');
    rollerDerbyTeams['2733'] = new RollerDerbyTeam('The Inhuman League', 758.6, 350, '2733');
    rollerDerbyTeams['2735'] = new RollerDerbyTeam('Toronto Mens Roller Derby', 762.7, 350, '2735');
    rollerDerbyTeams['2737'] = new RollerDerbyTeam('Tyne and Fear Roller Derby', 806, 550, '2737');
    rollerDerbyTeams['2738'] = new RollerDerbyTeam('Vancouver Murder', 600, 300, '2738');
    rollerDerbyTeams['3013'] = new RollerDerbyTeam('Terminus Roller Derby', 610, 300, '3013');
    rollerDerbyTeams['3326'] = new RollerDerbyTeam('Varsity Derby League', 600, 300, '3326');
    rollerDerbyTeams['3820'] = new RollerDerbyTeam('Granite City Brawlers', 600, 300, '3820');
    rollerDerbyTeams['3964'] = new RollerDerbyTeam('Houston Mens Roller Derby', 600, 300, '3964');
    rollerDerbyTeams['11869'] = new RollerDerbyTeam('Helsinki Coast Quads Roller Derby', 600, 300, '11869');
    rollerDerbyTeams['13122'] = new RollerDerbyTeam('Kent Mens Roller Derby', 689, 340, '13122');
    rollerDerbyTeams['17403'] = new RollerDerbyTeam('Pittsburgh Roller Derby', 787.3, 480, '17403');
    rollerDerbyTeams['17404'] = new RollerDerbyTeam('D.H.R. Men\'s Roller Derby', 515.5, 250, '17404');
    rollerDerbyTeams['17405'] = new RollerDerbyTeam('Flour City Roller Derby', 663.4, 380, '17405');
    rollerDerbyTeams['17908'] = new RollerDerbyTeam('Disorder', 792, 390, '17908');
    rollerDerbyTeams['17909'] = new RollerDerbyTeam('Borderland Bandits Roller Derby', 743, 400, '17909');
    rollerDerbyTeams['17910'] = new RollerDerbyTeam('Nordicks de Touraine', 600, 300, '17910');
    rollerDerbyTeams['17911'] = new RollerDerbyTeam('Roller Derby Toulouse', 600, 300, '17911');


    function getTeamRatingById(teamId) {
        const team = rollerDerbyTeams.find(team => team.teamId === teamId);
        return team ? team.rating : null;
    }

    function setTeamRatingById(teamId, rating, charter) {
        const team = rollerDerbyTeams.find(team => team.teamId === teamId);

        if (charter === 'Primary') {
            team.ratingA = rating;
        }
        else {
            team.ratingB = rating;
        }
    }

    function setTeamRatingById(teamId, rating) {
        setTeamRatingById(teamId, rating, 'Primary');
    }

    function getTeamById(teamId) {
        return rollerDerbyTeams.find(team => team.teamId === teamId) || null;
    }

    const date = new Date();

    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let currentDate = `${month}/${day}/${year}`;

    //console.log(currentDate); 
    const apiUrl = 'https://api.mrda.org/v1-public/sanctioning/algorithm?start-date=03/01/2023&end-date=' + `${currentDate}`;
    console.log(apiUrl);
    const apiUrl2 = 'https://api.mrda.org/v1-public/sanctioning/algorithm?start-date=03/01/2023&end-date=' + `${currentDate}` + '&status=4';
    console.log(apiUrl2);
    //let games = await fetchGames(apiUrl);

    let eloSystem = new RollerDerbyElo(rollerDerbyTeams);

    let groupedGames = await fetchGames(apiUrl);

    groupedGames.forEach(group => {
        console.log(`Processing games for sanctioning ID: ${group.sanctioningId}`);
        console.log(`Games: ${group.games}`);
        eloSystem.updateRatings(group.games);
    });

    let groupedGames2 = await fetchGames(apiUrl2);

    groupedGames2.forEach(group => {
        console.log(`Processing games for sanctioning ID: ${group.sanctioningId}`);
        console.log(`Games: ${group.games}`);
        eloSystem.updateRatings(group.games);
    });


    //eloSystem.updateRatings(games);

    let sortedRatings = Object.values(eloSystem.allTeams)
        .filter(team => team.numberOfGamesA >= 3 || team.numberOfGamesB >= 3)
        .flatMap(team => {
            let teams = [];
            if (team.numberOfGamesA >= 3) {
                teams.push({ name: team.teamName, rating: team.ratingA, teamType: 'A' });
            }
            if (team.numberOfGamesB >= 3) {
                teams.push({ name: team.teamName, rating: team.ratingB, teamType: 'B' });
            }
            return teams;
        })
        .sort((a, b) => b.rating - a.rating);

    let table = document.getElementById('rankings');

    sortedRatings.forEach((team, index) => {
        let row = table.insertRow();
        row.insertCell(0).innerText = index + 1;
        row.insertCell(1).innerText = `${team.name} (${team.teamType})` || team;
        row.insertCell(2).innerText = team.rating.toFixed(2);
    });

    // Populate dropdowns with team names
    const team1Select = document.getElementById('team1');
    const team2Select = document.getElementById('team2');
    const hypoTeam1Select = document.getElementById('hypo-team1');
    const hypoTeam2Select = document.getElementById('hypo-team2');
    const historyTeamSelect = document.getElementById('history-team');

    Object.values(rollerDerbyTeams).forEach(team => {
        const option1 = document.createElement('option');
        option1.value = team.teamId;
        option1.text = team.teamName;
        team1Select.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = team.teamId;
        option2.text = team.teamName;
        team2Select.appendChild(option2);

        const option3 = document.createElement('option');
        option3.value = team.teamId;
        option3.text = team.teamName;
        hypoTeam1Select.appendChild(option3);

        const option4 = document.createElement('option');
        option4.value = team.teamId;
        option4.text = team.teamName;
        hypoTeam2Select.appendChild(option4);

        const option5 = document.createElement('option');
        option5.value = team.teamId;
        option5.text = team.teamName;
        historyTeamSelect.appendChild(option5);
    });

    // Object.values(rollerDerbyTeams).forEach(team => {
    //     const option = document.createElement('option');
    //     option.value = team.teamId;
    //     option.text = team.teamName;
    //     historyTeamSelect.appendChild(option);
    // });
}

// Function to calculate and display the expected score between two teams
function calculateExpectedScore() {
    const team1Id = document.getElementById('team1').value;
    const team2Id = document.getElementById('team2').value;

    const team1 = rollerDerbyTeams[team1Id];
    const team2 = rollerDerbyTeams[team2Id];

    if (team1 && team2) {
        const eloSystem = new RollerDerbyElo(rollerDerbyTeams);
        const expectedScore1 = eloSystem.expectedScore(team1.ratingA, team2.ratingA);
        const expectedScore2 = 1 - expectedScore1;

        document.getElementById('score-result').innerText = `Expected Score: ${team1.teamName} ${expectedScore1.toFixed(2)} - ${team2.teamName} ${expectedScore2.toFixed(2)}`;
    } else {
        document.getElementById('score-result').innerText = 'Please select both teams.';
    }
}

// Function to calculate and display the hypothetical rating adjustment
function calculateHypotheticalAdjustment() {
    const team1Id = document.getElementById('hypo-team1').value;
    const team1Score = parseInt(document.getElementById('hypo-team1-score').value, 10);
    const team2Id = document.getElementById('hypo-team2').value;
    const team2Score = parseInt(document.getElementById('hypo-team2-score').value, 10);

    const team1 = rollerDerbyTeams[team1Id];
    const team2 = rollerDerbyTeams[team2Id];

    if (team1 && team2 && !isNaN(team1Score) && !isNaN(team2Score)) {
        const eloSystem = new RollerDerbyElo(rollerDerbyTeams);
        const ra = team1.ratingA;
        const rb = team2.ratingA;
        const ea = eloSystem.expectedScore(ra, rb);
        const eb = eloSystem.expectedScore(rb, ra);

        const sa = eloSystem.sigmoid_actual_score(team1Score, team2Score);
        const sb = 1 - sa;

        const k = 128;
        const adjustA = k * (sa - ea);
        const adjustB = k * (sb - eb);

        const newRatingA = ra + adjustA;
        const newRatingB = rb + adjustB;

        document.getElementById('adjustment-result').innerText = `
            Hypothetical Adjustment:
            ${team1.teamName}: ${ra.toFixed(2)} -> ${newRatingA.toFixed(2)} (Adjustment: ${adjustA.toFixed(2)})
            ${team2.teamName}: ${rb.toFixed(2)} -> ${newRatingB.toFixed(2)} (Adjustment: ${adjustB.toFixed(2)})
        `;
    } else {
        document.getElementById('adjustment-result').innerText = 'Please select both teams and enter valid scores.';
    }
}

// Function to show the last 5 games of a selected team
function showTeamHistory(charterType) {
    const teamId = document.getElementById('history-team').value;
    const team = rollerDerbyTeams[teamId];

    if (team) {
        const gameHistory = team.getLast5Games(charterType);
        const historyBody = document.getElementById('history-body');
        historyBody.innerHTML = '';  // Clear previous history

        gameHistory.forEach(game => {
            const row = historyBody.insertRow();
            const dateCell = row.insertCell(0);
            const opponentCell = row.insertCell(1);
            const scoreCell = row.insertCell(2);
            const eloChangeCell = row.insertCell(3);

            dateCell.innerText = game.date;
            opponentCell.innerText = game.opponent;
            scoreCell.innerText = `${game.teamScore} - ${game.opponentScore}`;
            eloChangeCell.innerText = game.eloChange.toFixed(2);
        });
    } else {
        document.getElementById('history-body').innerText = 'Please select a team.';
    }
}


class RollerDerbyTeam {
    constructor(teamName, ratingA, ratingB, teamId) {
        this.teamName = teamName;
        this.ratingA = ratingA;
        this.ratingB = ratingB;
        this.teamId = teamId;
        this.gameHistoryA = []; // Initialize gameHistory as an empty array
        this.gameHistoryB = []; // Initialize gameHistory as an empty array
    }

    numberOfGamesA = 0;
    numberOfGamesB = 0;

    getTeamInfo() {
        return `Team Name: ${this.teamName}, Rating: ${this.ratingA}, Team ID: ${this.teamId}`;
    }

    addGameResult(charterType, date, opponent, teamScore, opponentScore, eloChange, currentElo) {

        if (charterType === 'primary') {
            this.gameHistoryA.push({
                date: date,
                opponent: opponent,
                teamScore: teamScore,
                opponentScore: opponentScore,
                eloChange: eloChange,
                currentElo: currentElo
            });
        }
        else {
            this.gameHistoryB.push({
                date: date,
                opponent: opponent,
                teamScore: teamScore,
                opponentScore: opponentScore,
                eloChange: eloChange,
                currentElo: currentElo
            });
        }


        // Keep only the last 5 games
        if (this.gameHistoryA.length > 5) {
            this.gameHistoryA.shift();
        }

        // Keep only the last 5 games
        if (this.gameHistoryB.length > 5) {
            this.gameHistoryB.shift();
        }
    }

    getLast5Games(charterType) {
        if (charterType === 'primary') {
            return this.gameHistoryA.slice(-5).reverse(); // Return last 5 games, most recent first
        }
        else {
            return this.gameHistoryB.slice(-5).reverse(); // Return last 5 games, most recent first
        }

    }
}

window.addEventListener('load', main);
