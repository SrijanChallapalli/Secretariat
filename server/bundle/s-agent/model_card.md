# S-Agent Model Card

## Purpose
Top 3 stallion recommendations for a given mare with emphasis on pedigree synergy and complementary traits. Secretariat integration of https://github.com/Ayaan-Ameen07/S-Agent.

## Formula
- compatibility = w_traits * cosine_similarity(traits) + w_pedigree * pedigree_synergy + w_complement * complement_score - w_cost * normalized_fee + w_form * performance_proxy

## Features (8 traits)
Speed, Stamina, Temperament, Conformation, Health, Agility, Race IQ, Consistency (0-100 each).

## Complement score
Stallion strengths where mare is weaker (trait < 80).

## Risk flags
Injury, high fee, low trait complement, pedigree mismatch.

## Limitations
Demo/backtest only; not calibrated to real breeding outcomes.
