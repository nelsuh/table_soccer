# Table Soccer

A turn-based mini soccer game designed for **mobile web** and integrated with **Usion SDK**.

## Overview

**Table Soccer** is a simple 1v1 turn-based game inspired by tabletop soccer.  
Players take turns controlling disks to shoot the ball toward the opponent’s goal.  
The first player to score **3 goals** wins the match.

---

## Game Concept

- **Genre:** Turn-based sports mini game
- **Platform:** Mobile Web
- **SDK:** Usion SDK
- **Players:** 2 players
- **Winning Condition:** First player to reach **3 goals**

---

## Core Gameplay Flow

### 1. Match Start / Tactic Selection

When both players join the session, each player must choose:

- **Attacking tactic**
- **Defending tactic**

Players have **10 seconds** to make their selections.

**Reference image:**  
`D:\mini_games\table_soccer\tactic.jpg`

#### Notes
- If a player does not choose within 10 seconds, a default tactic should be assigned automatically.
- Both tactics should affect player behavior or disk positioning during the match.

---

### 2. First Player Turn

After tactics are selected, the first player starts their turn.

During the turn:
- The player selects one of their disks
- The player drags to aim
- The game displays the **shoot direction**
- Releasing the drag performs the shot

**Reference images:**  
- `D:\mini_games\table_soccer\my_turn.jpg`
- `D:\mini_games\table_soccer\prepare_Shoot.jpg`

#### Turn Interaction
- Tap or drag a player disk
- Show direction indicator while dragging
- Apply shot force based on drag distance
- Release to shoot

---

### 3. Turn-Based Shooting

Players take turns trying to shoot the ball into the opponent’s goal.

#### Rules
- Only the current player can act
- Each turn allows one shot
- After the shot finishes and all movement stops, the turn passes to the opponent
- The next player begins their turn and repeats the process

---

### 4. Goal Scoring

When the ball enters a goal:

- The attacking player gets **+1 score**
- The round ends
- The opponent starts the next round as the attacker

#### After a Goal
- Reset ball position
- Reset player disks if needed
- Update scoreboard
- Start next round

---

### 5. Win Condition

The match ends when one player reaches **3 goals**.

#### End of Match
- Show winner screen
- Show final score
- Offer options:
  - Play again
  - Exit match

---

## Game Rules Summary

- 2-player turn-based match
- Each player chooses tactics before the game starts
- One shot per turn
- Goal = 1 point
- Opponent starts after conceding a goal
- First to 3 goals wins

---

## Features

### Gameplay Features
- Turn-based player control
- Drag-to-aim shooting mechanic
- Direction preview before shooting
- Score tracking
- Goal detection
- Match win detection
- Round reset after goal

### UX Features
- Mobile-friendly controls
- Clear current-turn indicator
- Tactic selection timer
- Shot direction visual feedback
- Win/lose result screen

---

## Screens / States

### 1. Lobby / Waiting Room
- Players join session
- Wait until both players are ready

### 2. Tactic Selection Screen
- Choose attack and defense tactics
- 10-second countdown

### 3. Main Match Screen
- Game board
- Player disks
- Ball
- Goals
- Current turn indicator
- Scoreboard

### 4. Aiming State
- Disk selected
- Drag direction visible
- Shot power preview

### 5. Goal / Round Reset State
- Goal animation or feedback
- Score update
- Reset board for next round

### 6. Match Result Screen
- Winner announcement
- Final score
- Replay / exit options

---

## Suggested Technical Breakdown

## Core Systems

### 1. Match System
- Create/join session
- Track players
- Start game when both players are ready

### 2. Turn System
- Track current player turn
- Lock input for non-active player
- Pass turn after motion ends

### 3. Tactic System
- Store attacking and defending tactics
- Apply selected tactics to gameplay setup or disk formation

### 4. Input / Shooting System
- Select disk
- Drag to aim
- Calculate shot direction and force
- Trigger disk movement

### 5. Physics / Collision System
- Disk movement
- Ball movement
- Disk-ball collisions
- Boundary collisions
- Goal detection

### 6. Score System
- Increment score on goal
- Check win condition
- Trigger round reset or match end

### 7. UI System
- Timer UI
- Turn indicator
- Scoreboard
- Win screen
- Tactic selection UI

---

## TODO

## Game Design
- [ ] Finalize attacking tactics
- [ ] Finalize defending tactics
- [ ] Define how tactics affect gameplay
- [ ] Define disk spawn/reset positions
- [ ] Define turn order for first round
- [ ] Define default tactic if timer ends

## Gameplay Implementation
- [ ] Implement 2-player session flow
- [ ] Implement tactic selection with 10-second timer
- [ ] Implement turn system
- [ ] Implement disk selection
- [ ] Implement drag-to-aim mechanic
- [ ] Implement shot direction preview
- [ ] Implement shot force calculation
- [ ] Implement ball and disk physics
- [ ] Implement collision handling
- [ ] Implement goal detection
- [ ] Implement score update
- [ ] Implement round reset after goal
- [ ] Implement match end when score reaches 3

## UI / UX
- [ ] Create tactic selection screen
- [ ] Create match HUD
- [ ] Show current player turn
- [ ] Show score
- [ ] Show countdown timer
- [ ] Add goal feedback animation
- [ ] Add winner/result screen
- [ ] Make controls mobile friendly

## Integration
- [ ] Integrate with Usion SDK
- [ ] Handle session creation/joining
- [ ] Sync turns between players
- [ ] Sync score and match state
- [ ] Sync round reset events

## Polish
- [ ] Add sound effects
- [ ] Add simple animations
- [ ] Improve aiming visuals
- [ ] Improve goal celebration
- [ ] Test on mobile devices
- [ ] Optimize performance for web

---

## Asset References

- Tactic selection:  
  `D:\mini_games\table_soccer\tactic.jpg`

- Current turn screen:  
  `D:\mini_games\table_soccer\my_turn.jpg`

- Shot preparation / aim direction:  
  `D:\mini_games\table_soccer\prepare_Shoot.jpg`

- Developer guide:  
  `D:\mini_games\table_soccer\DEVELOPER_GUIDE (2).md`

---

## Suggested Future Enhancements

- Different team themes or skins
- More tactic types
- Power shots or special moves
- Match timer mode
- Single-player vs AI
- Leaderboard
- Sound and vibration feedback

---

## Simple Match Example

1. Two players join the session  
2. Both players select attack and defense tactics within 10 seconds  
3. Player 1 starts the first turn  
4. Player 1 drags a disk and shoots  
5. When movement stops, Player 2 gets the turn  
6. If a goal is scored, scorer gets +1  
7. Opponent starts the next round  
8. First player to reach 3 goals wins the match  

---

## Notes

This README serves as both:
- a **game concept document**
- a **development TODO list**

The main focus is to keep the gameplay:
- simple
- competitive
- mobile-friendly
- easy to integrate with Usion SDK